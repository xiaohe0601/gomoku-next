import { Board } from "./Board";
import { ItemSystem } from "./ItemSystem";
import { GameMode, GameState, GameSubState, ItemType, MoveEventType, Player } from "./types";
import type {
  BlindBox,
  BoardSize,
  GameConfig,
  GameMoveCountState,
  GameResult,
  GameStateChangeCallback,
  Move,
  MoveEvent,
  PlayerItem,
  PlayerMoveCount,
  Position
} from "./types";

export class GomokuGame {

  private board: Board;
  private currentPlayer: Player = Player.BLACK;
  private gameState: GameState = GameState.READY;
  private gameSubState: GameSubState = GameSubState.NORMAL;
  private gameResult: GameResult | null = null;
  private moveHistory: Move[] = [];
  private config: GameConfig = {
    mode: GameMode.PVP,
    playerColor: Player.BLACK,
    difficulty: "medium",
    enableItems: true
  };

  private aiTimer: number | null = null; // 用于跟踪AI计算的定时器
  private isAiCalculating: boolean = false; // AI是否正在计算
  private itemSystem: ItemSystem = new ItemSystem(); // 道具系统实例
  private blindBoxes: BlindBox[] = []; // 棋盘上的盲盒列表
  private playerItems: Map<Player, PlayerItem[]> = new Map(); // 玩家拥有的道具
  private activeEffects: Map<Player, PlayerItem[]> = new Map(); // 当前激活的道具效果
  private lastItemUsed: ItemType | null = null; // 最后使用的道具类型
  private itemNameDisplayTimer: number | null = null; // 道具名称显示定时器
  private strategyGuidePositions: Position[] = []; // 策略指引推荐的位置
  private hasExtraMove: boolean = false; // 是否有额外落子机会
  private nextPlayerHasExtraMove: boolean = false; // 下一个玩家是否有额外落子机会
  private nextPlayerHasSlipPenalty: boolean = false; // 下一个玩家是否有手滑惩罚
  private allowedPositions: Position[] = []; // 手滑惩罚时允许落子的位置
  private notification: string | null = null; // 当前显示的提示信息
  private notificationTimer: number | null = null; // 提示信息定时器
  private preciseStrikePlayer: Player | null = null; // 触发精准打击的玩家
  private preciseStrikeHasExtraMove: boolean = false; // 触发精准打击时是否有额外落子机会
  private gameMoveCountState: GameMoveCountState; // 游戏落子计数状态
  private gameStateChangeCallbacks: GameStateChangeCallback[] = []; // 游戏状态变化回调

  /**
   * 构造函数
   * @param size 棋盘大小（15或19）
   */
  constructor(size: BoardSize = 15) {
    this.board = new Board(size);

    // 初始化玩家道具和效果映射
    this.playerItems.set(Player.BLACK, []);
    this.playerItems.set(Player.WHITE, []);
    this.activeEffects.set(Player.BLACK, []);
    this.activeEffects.set(Player.WHITE, []);

    // 初始化落子计数状态
    this.gameMoveCountState = this.createGameMoveCountState();
  }

  /**
   * 创建游戏落子计数状态
   */
  private createGameMoveCountState(): GameMoveCountState {
    return {
      players: new Map([
        [Player.BLACK, this.createPlayerMoveCount(Player.BLACK)],
        [Player.WHITE, this.createPlayerMoveCount(Player.WHITE)]
      ]),
      currentPlayer: this.currentPlayer,
      currentMoveEventId: ""
    };
  }

  /**
   * 创建玩家落子计数
   * @param player 玩家
   */
  private createPlayerMoveCount(player: Player): PlayerMoveCount {
    return {
      player,
      originalMoveCount: 0,
      extraMovesEarned: 0,
      extraMovesUsed: 0,
      currentExtraMoves: 0,
      moveEvents: []
    };
  }

  /**
   * 生成落子事件ID
   */
  private generateMoveEventId(): string {
    return `move_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 记录落子事件
   * @param type 事件类型
   * @param description 事件描述
   * @param itemType 道具类型（可选）
   * @param extraMovesAdded 增加的额外落子次数（可选）
   */
  private recordMoveEvent(type: MoveEventType, description: string, itemType?: ItemType, extraMovesAdded?: number): void {
    const event: MoveEvent = {
      moveId: this.generateMoveEventId(),
      timestamp: Date.now(),
      player: this.currentPlayer,
      type,
      itemType,
      extraMovesAdded,
      description
    };

    const playerMoveCount = this.gameMoveCountState.players.get(this.currentPlayer)!;
    playerMoveCount.moveEvents.push(event);
    this.gameMoveCountState.currentMoveEventId = event.moveId;
  }

  /**
   * 添加额外落子机会
   * @param player 玩家
   * @param source 来源描述
   * @param itemType 道具类型（可选）
   */
  private addExtraMove(player: Player, source: string, itemType?: ItemType): void {
    const playerMoveCount = this.gameMoveCountState.players.get(player)!;
    playerMoveCount.extraMovesEarned++;
    playerMoveCount.currentExtraMoves++;

    this.recordMoveEvent(
      MoveEventType.ITEM_TRIGGER,
      `${source}增加1次额外落子机会`,
      itemType,
      1
    );
  }

  /**
   * 校验落子次数一致性
   * @returns 是否一致
   */
  private validateMoveCountConsistency(): boolean {
    let isConsistent = true;

    for (const [_, moveCount] of this.gameMoveCountState.players) {
      const calculatedExtraMoves = moveCount.extraMovesEarned - moveCount.extraMovesUsed;
      if (calculatedExtraMoves !== moveCount.currentExtraMoves) {
        // 发现不一致，修复
        moveCount.currentExtraMoves = calculatedExtraMoves;
        isConsistent = false;
      }
    }
    return isConsistent;
  }

  /**
   * 设置游戏配置
   * @param config 游戏配置
   */
  setConfig(config: Partial<GameConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * 获取游戏配置
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * 开始新游戏
   */
  startNewGame(): void {
    // 清理AI定时器
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    this.isAiCalculating = false;

    // 清理道具相关状态
    this.blindBoxes = [];
    this.playerItems.clear();
    this.activeEffects.clear();
    this.lastItemUsed = null;
    if (this.itemNameDisplayTimer) {
      clearTimeout(this.itemNameDisplayTimer);
      this.itemNameDisplayTimer = null;
    }
    this.strategyGuidePositions = [];
    this.gameSubState = GameSubState.NORMAL;
    this.hasExtraMove = false;
    this.nextPlayerHasExtraMove = false;
    this.nextPlayerHasSlipPenalty = false;
    this.allowedPositions = [];
    this.clearNotification();
    this.preciseStrikePlayer = null;
    this.preciseStrikeHasExtraMove = false;

    // 重新初始化落子计数状态
    this.gameMoveCountState = this.createGameMoveCountState();

    // 初始化玩家道具和效果映射
    this.playerItems.set(Player.BLACK, []);
    this.playerItems.set(Player.WHITE, []);
    this.activeEffects.set(Player.BLACK, []);
    this.activeEffects.set(Player.WHITE, []);

    // 重置游戏状态
    this.board.reset();
    this.currentPlayer = Player.BLACK;
    this.gameState = GameState.PLAYING;
    this.gameResult = null;
    this.moveHistory = [];

    // 如果是PVE模式，且玩家选择白棋，电脑先走
    if (this.config.mode === GameMode.PVE && this.config.playerColor === Player.WHITE) {
      this.isAiCalculating = true;
      this.aiTimer = setTimeout(() => {
        this.isAiCalculating = false;
        this.aiTimer = null;
        this.makeAIMove();
      }, 500) as unknown as number;
    }
  }

  /**
   * 获取当前游戏状态
   */
  getGameState(): GameState {
    return this.gameState;
  }

  /**
   * 获取当前玩家
   */
  getCurrentPlayer(): Player {
    return this.currentPlayer;
  }

  /**
   * 获取棋盘
   */
  getBoard(): Board {
    return this.board;
  }

  /**
   * 获取游戏结果
   */
  getGameResult(): GameResult | null {
    return this.gameResult;
  }

  /**
   * 在指定位置落子
   * @param position 落子位置
   * @returns 是否落子成功
   */
  makeMove(position: Position): boolean {
    if (this.gameState !== GameState.PLAYING) {
      return false;
    }

    // 如果是PVE模式，且当前是电脑回合，不允许玩家落子
    if (this.config.mode === GameMode.PVE && this.currentPlayer !== this.config.playerColor) {
      return false;
    }

    // 处理精准打击选择模式
    if (this.gameSubState === GameSubState.SELECTING_STRIKE_TARGET) {
      // 使用保存的触发玩家来确定对手，确保不会出错
      if (!this.preciseStrikePlayer) {
        // 如果没有保存触发玩家，恢复正常状态
        this.gameSubState = GameSubState.NORMAL;
        return false;
      }

      // 触发精准打击的玩家是preciseStrikePlayer，对手是另一个玩家
      const opponent = this.preciseStrikePlayer === Player.BLACK ? Player.WHITE : Player.BLACK;

      // 检查选择的位置是否有对手棋子
      if (this.board.getStone(position) === opponent) {
        // 检查对手是否有钢化我心效果
        const opponentActiveEffects = this.activeEffects.get(opponent) || [];
        const hasToughenHeart = opponentActiveEffects.some((effect) => effect.itemType === ItemType.TOUGHEN_HEART);

        if (hasToughenHeart) {
          // 移除钢化我心效果
          this.removeEffect(opponent, ItemType.TOUGHEN_HEART);
          const message = `${opponent === Player.BLACK ? "黑方" : "白方"} 使用「钢化我心」免疫了精准打击！`;
          // 钢化我心抵挡攻击成功日志
          console.log(`钢化我心：玩家 ${opponent} 使用「钢化我心」抵挡了「精准打击」`);
          this.showNotification(message, 3000);
        } else {
          // 移除对手棋子
          this.board.removeStone(position);
          // 精准打击效果日志
          if (this.preciseStrikePlayer) {
            console.log(`精准打击：玩家 ${this.preciseStrikePlayer} 的对手被指定移除 [${position.x}, ${position.y}] 位置的棋子`);
          }
        }

        // 保存触发精准打击的玩家信息
        const triggerPlayer = this.preciseStrikePlayer;

        // 恢复正常游戏状态
        this.gameSubState = GameSubState.NORMAL;

        // 恢复之前保存的额外落子状态
        this.hasExtraMove = this.preciseStrikeHasExtraMove;

        this.preciseStrikePlayer = null; // 重置触发玩家信息
        this.preciseStrikeHasExtraMove = false; // 重置保存的额外落子状态

        // 精准打击不算作落子，所以不应该影响正常的落子流程
        // 检查是否有加速落子效果，如果有，继续自己落子
        // 否则，切换到对手落子
        if (!this.hasExtraMove && triggerPlayer) {
          // 没有加速落子效果，切换到对手落子
          this.currentPlayer = triggerPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;

          // 如果是PVE模式，且当前是电脑回合，自动落子
          if (this.config.mode === GameMode.PVE && this.currentPlayer !== this.config.playerColor) {
            this.isAiCalculating = true;
            this.aiTimer = setTimeout(() => {
              this.isAiCalculating = false;
              this.aiTimer = null;
              this.makeAIMove();
            }, 500) as unknown as number; // 延迟500ms，让玩家有时间看到切换
          }
        }
        // 有加速落子效果，不消耗该效果，继续自己落子
        // 加速落子效果将在实际落子时消耗

        // 精准打击的点击不算作落子，返回false
        return false;
      }
      return false;
    }

    // 检查手滑惩罚：是否只能在指定位置落子
    if (this.allowedPositions.length > 0) {
      const isAllowedPosition = this.allowedPositions.some((pos) =>
        pos.x === position.x && pos.y === position.y
      );
      if (!isAllowedPosition) {
        return false;
      }
    }

    // 尝试落子
    if (!this.board.placeStone(position, this.currentPlayer)) {
      return false;
    }

    // 记录落子
    const move: Move = {
      position: { ...position },
      player: this.currentPlayer,
      timestamp: Date.now()
    };
    this.moveHistory.push(move);

    // 记录落子事件
    if (this.hasExtraMove) {
      // 额外落子
      this.recordMoveEvent(MoveEventType.EXTRA_MOVE, "使用额外落子机会");
    } else {
      // 正常落子
      this.recordMoveEvent(MoveEventType.NORMAL_MOVE, "正常落子");
    }

    // 检查胜负
    const result = this.checkWin(position, this.currentPlayer);
    if (result.winner) {
      this.gameState = GameState.OVER;
      this.gameResult = result;
      this.notifyGameStateChange(); // 通知游戏状态变化
      return true;
    }

    // 检查是否平局（棋盘已满）
    if (this.moveHistory.length === this.board.getSize() * this.board.getSize()) {
      this.gameState = GameState.OVER;
      this.gameResult = {
        winner: null,
        winningLine: []
      };
      this.notifyGameStateChange(); // 通知游戏状态变化
      return true;
    }

    // 检查当前落子是否是在手滑惩罚允许的位置内
    const wasHandSlipPenaltyMove = this.allowedPositions.some((pos) =>
      pos.x === position.x && pos.y === position.y
    );

    // 清除手滑惩罚状态：无论是否有加速落子，都需要先清除手滑惩罚状态
    if (wasHandSlipPenaltyMove && this.allowedPositions.length > 0) {
      this.allowedPositions = [];
      // 恢复正常游戏状态
      if (this.gameSubState === GameSubState.HAND_SLIP_PENALTY) {
        this.gameSubState = GameSubState.NORMAL;
      }
    }

    // 清除策略指引：落子后关闭策略指引
    if (this.gameSubState === GameSubState.SHOWING_STRATEGY_GUIDE) {
      this.gameSubState = GameSubState.NORMAL;
      this.strategyGuidePositions = [];
    }

    // 开启盲盒（如果落子位置有盲盒）
    this.openBlindBoxAtPosition(position);

    // 如果开启盲盒后进入了需要玩家交互的特殊状态，立即返回，等待玩家操作
    // 排除 SHOWING_ITEM_NAME 状态（只是显示道具名称的临时状态）
    // 排除 SHOWING_STRATEGY_GUIDE 状态（策略指引不需要等待，玩家可以直接落子）
    if (
      this.gameSubState !== GameSubState.NORMAL
      && this.gameSubState !== GameSubState.SHOWING_ITEM_NAME
      // @ts-expect-error whatever
      && this.gameSubState !== GameSubState.SHOWING_STRATEGY_GUIDE
    ) {
      // 生成新盲盒（如果道具系统已启用）
      if (this.config.enableItems) {
        this.generateNewBlindBox();
      }
      return true;
    }

    // 生成新盲盒（如果道具系统已启用）
    if (this.config.enableItems) {
      this.generateNewBlindBox();
    }

    // 处理加速落子效果：如果有额外落子机会，不切换玩家
    if (this.hasExtraMove) {
      // 更新落子计数
      const playerMoveCount = this.gameMoveCountState.players.get(this.currentPlayer)!;
      playerMoveCount.extraMovesUsed++;
      playerMoveCount.currentExtraMoves--;

      // 重新检查是否还有剩余的额外落子机会
      this.hasExtraMove = playerMoveCount.currentExtraMoves > 0;

      // 校验落子次数一致性
      this.validateMoveCountConsistency();

      return true;
    }

    // 更新落子计数：正常落子
    const playerMoveCount = this.gameMoveCountState.players.get(this.currentPlayer)!;
    playerMoveCount.originalMoveCount++;

    // 切换玩家
    this.currentPlayer = this.currentPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;

    // 更新落子计数系统的当前玩家
    this.gameMoveCountState.currentPlayer = this.currentPlayer;

    // 处理对手加速效果：如果对手有额外落子机会，让对手获得额外落子机会
    if (this.nextPlayerHasExtraMove) {
      this.addExtraMove(this.currentPlayer, "对手加速", ItemType.OPPONENT_ACCELERATION);
      this.nextPlayerHasExtraMove = false;
      // 基于实际额外落子机会数量设置hasExtraMove标志
      this.hasExtraMove = this.gameMoveCountState.players.get(this.currentPlayer)!.currentExtraMoves > 0;
    }

    // 处理手滑惩罚效果：如果对手有手滑惩罚，应用到当前玩家
    if (this.nextPlayerHasSlipPenalty) {
      this.applySlipPenalty();
      this.gameSubState = GameSubState.HAND_SLIP_PENALTY;
      this.nextPlayerHasSlipPenalty = false;
    }

    // 校验落子次数一致性
    this.validateMoveCountConsistency();

    // 如果是PVE模式，且当前是电脑回合，自动落子
    if (this.config.mode === GameMode.PVE && this.currentPlayer !== this.config.playerColor) {
      // 允许在正常状态、显示道具名称状态和手滑惩罚状态下执行AI落子
      // SHOWING_ITEM_NAME是临时状态，不会影响玩家操作
      // HAND_SLIP_PENALTY只是限制落子位置，不影响AI落子执行
      if (this.gameSubState === GameSubState.NORMAL
        || this.gameSubState === GameSubState.SHOWING_ITEM_NAME
        || this.gameSubState === GameSubState.HAND_SLIP_PENALTY) {
        this.isAiCalculating = true;
        this.aiTimer = setTimeout(() => {
          this.isAiCalculating = false;
          this.aiTimer = null;
          this.makeAIMove();
        }, 500) as unknown as number; // 延迟500ms，让玩家有时间看到切换
      }
    }

    return true;
  }

  /**
   * 电脑AI自动落子
   */
  private makeAIMove(): void {
    if (this.gameState !== GameState.PLAYING) {
      return;
    }

    // 检查是否有手滑惩罚需要应用到当前AI玩家
    if (this.nextPlayerHasSlipPenalty) {
      this.applySlipPenalty();
      this.gameSubState = GameSubState.HAND_SLIP_PENALTY;
      this.nextPlayerHasSlipPenalty = false;
    }

    // 获取所有可用位置
    let availablePositions: Position[] = [];
    const size = this.board.getSize();

    // 如果有手滑惩罚，只能从允许的位置中选择
    if (this.gameSubState === GameSubState.HAND_SLIP_PENALTY && this.allowedPositions.length > 0) {
      // 使用手滑惩罚允许的位置
      availablePositions = this.allowedPositions;
    } else {
      // 获取所有空位置
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const pos = { x, y };
          if (this.board.isEmpty(pos)) {
            availablePositions.push(pos);
          }
        }
      }
    }

    if (availablePositions.length === 0) {
      return; // 没有可用位置
    }

    // 基于评分系统选择最佳位置
    let bestScore = -Infinity;
    let bestPosition = availablePositions[0];

    availablePositions.forEach((pos) => {
      const score = this.evaluatePosition(pos);
      if (score > bestScore) {
        bestScore = score;
        bestPosition = pos;
      }
    });

    // 执行落子
    this.board.placeStone(bestPosition, this.currentPlayer);

    // 记录落子
    const move: Move = {
      position: { ...bestPosition },
      player: this.currentPlayer,
      timestamp: Date.now()
    };
    this.moveHistory.push(move);

    // 检查胜负
    const result = this.checkWin(bestPosition, this.currentPlayer);
    if (result.winner) {
      this.gameState = GameState.OVER;
      this.gameResult = result;
      this.notifyGameStateChange(); // 通知游戏状态变化
      return;
    }

    // 检查是否平局
    if (this.moveHistory.length === size * size) {
      this.gameState = GameState.OVER;
      this.gameResult = {
        winner: null,
        winningLine: []
      };
      this.notifyGameStateChange(); // 通知游戏状态变化
      return;
    }

    // 清除手滑惩罚状态
    if (this.gameSubState === GameSubState.HAND_SLIP_PENALTY) {
      this.gameSubState = GameSubState.NORMAL;
      this.allowedPositions = [];
    }

    // 开启盲盒（如果落子位置有盲盒）
    this.openBlindBoxAtPosition(bestPosition);

    // 生成新盲盒（如果道具系统已启用）
    if (this.config.enableItems) {
      this.generateNewBlindBox();
    }

    // 处理对手加速效果：如果对手有额外落子机会，让对手获得额外落子机会
    if (this.nextPlayerHasExtraMove) {
      this.addExtraMove(this.currentPlayer, "对手加速", ItemType.OPPONENT_ACCELERATION);
      this.nextPlayerHasExtraMove = false;
      // 基于实际额外落子机会数量设置hasExtraMove标志
      this.hasExtraMove = this.gameMoveCountState.players.get(this.currentPlayer)!.currentExtraMoves > 0;
    }

    // 处理加速落子效果：如果有额外落子机会，不切换玩家，继续落子
    if (this.hasExtraMove) {
      // 记录额外落子事件
      this.recordMoveEvent(MoveEventType.EXTRA_MOVE, "AI使用额外落子机会");

      // 更新落子计数
      const playerMoveCount = this.gameMoveCountState.players.get(this.currentPlayer)!;
      playerMoveCount.extraMovesUsed++;
      playerMoveCount.currentExtraMoves--;

      // 重新检查是否还有剩余的额外落子机会
      this.hasExtraMove = playerMoveCount.currentExtraMoves > 0;

      // 校验落子次数一致性
      this.validateMoveCountConsistency();

      // 继续执行AI落子，使用setTimeout确保UI更新
      setTimeout(() => {
        this.makeAIMove();
      }, 500);
      this.notifyGameStateChange(); // 通知游戏状态变化
      return;
    }

    // 切换玩家
    this.currentPlayer = this.currentPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;
    this.notifyGameStateChange(); // 通知游戏状态变化
  }

  /**
   * 开启指定位置的盲盒
   * @param position 位置
   */
  private openBlindBoxAtPosition(position: Position): void {
    const blindBoxIndex = this.blindBoxes.findIndex((box) =>
      !box.isOpened && box.position.x === position.x && box.position.y === position.y
    );

    if (blindBoxIndex !== -1) {
      // 标记盲盒为已开启
      const blindBox = this.blindBoxes[blindBoxIndex];
      blindBox.isOpened = true;
      this.lastItemUsed = blindBox.itemType;

      // 触发盲盒道具时打印日志
      console.log(`玩家 ${this.currentPlayer} 使用道具：${this.itemSystem.getItemInfo(blindBox.itemType).name}`);

      // 触发道具效果
      this.triggerItemEffect(blindBox.itemType, this.currentPlayer);

      // 对于手滑惩罚，直接保持其特殊状态，不显示道具名称
      // 其他特殊状态也保持不变
      if (this.gameSubState === GameSubState.NORMAL) {
        // 只有当没有触发特殊状态时，才显示道具名称
        this.gameSubState = GameSubState.SHOWING_ITEM_NAME;
        if (this.itemNameDisplayTimer) {
          clearTimeout(this.itemNameDisplayTimer);
        }
        this.itemNameDisplayTimer = setTimeout(() => {
          // 只有当当前状态仍然是SHOWING_ITEM_NAME时才切换到NORMAL
          // 防止覆盖其他状态（如SELECTING_STRIKE_TARGET）
          if (this.gameSubState === GameSubState.SHOWING_ITEM_NAME) {
            this.gameSubState = GameSubState.NORMAL;
          }
          this.itemNameDisplayTimer = null;
        }, 1000) as unknown as number;
      }
    }
  }

  /**
   * 生成新盲盒
   */
  private generateNewBlindBox(): void {
    // 获取所有可用位置（不包括已有的盲盒位置）
    const availablePositions: Position[] = [];
    const size = this.board.getSize();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pos = { x, y };
        // 检查位置是否为空且没有盲盒
        const hasBlindBox = this.blindBoxes.some((box) =>
          !box.isOpened && box.position.x === x && box.position.y === y
        );

        if (this.board.isEmpty(pos) && !hasBlindBox) {
          availablePositions.push(pos);
        }
      }
    }

    // 生成盲盒
    const newBlindBox = this.itemSystem.generateBlindBox(availablePositions);
    if (newBlindBox) {
      this.blindBoxes.push(newBlindBox);
    }
  }

  /**
   * 触发道具效果
   * @param itemType 道具类型
   * @param player 玩家
   */
  private triggerItemEffect(itemType: ItemType, player: Player): void {
    // 这里将实现具体的道具效果逻辑

    // 简单示例：根据道具类型执行不同逻辑
    switch (itemType) {
      case ItemType.CHAOS_STRIKE: {
        // 混沌打击：随机移除对手的1颗棋子
        this.performChaosStrike(player);
        break;
      }
      case ItemType.PRECISE_STRIKE: {
        // 精准打击：允许玩家指定移除对手的1颗棋子
        if (this.config.mode === GameMode.PVE && this.currentPlayer !== this.config.playerColor) {
          // AI玩家使用精准打击，自动选择目标
          this.performPreciseStrikeForAI(player);
        } else {
          // 人类玩家使用精准打击，进入选择目标状态
          this.gameSubState = GameSubState.SELECTING_STRIKE_TARGET;
          this.preciseStrikePlayer = player; // 保存触发精准打击的玩家信息
          this.preciseStrikeHasExtraMove = this.hasExtraMove; // 保存当前的额外落子状态
          this.hasExtraMove = false; // 临时清除额外落子状态，避免影响精准打击流程
        }
        break;
      }
      case ItemType.ACCELERATED_MOVE: {
        // 加速落子：使玩家在本回合获得额外1次落子机会
        this.addExtraMove(player, "加速落子", ItemType.ACCELERATED_MOVE);
        // 检查当前玩家是否还有额外落子机会
        this.hasExtraMove = this.gameMoveCountState.players.get(this.currentPlayer)!.currentExtraMoves > 0;
        // 加速落子效果日志
        console.log(`加速落子：玩家 ${player} 获得额外 1 次落子机会`);
        break;
      }
      case ItemType.STRATEGY_GUIDE: {
        // 策略指引：额外获得1次落子机会，并且系统将推荐3个最优落子位置
        // 保存当前玩家，防止showStrategyGuide修改导致的问题
        const originalCurrentPlayer = this.currentPlayer;
        try {
          if (this.config.mode === GameMode.PVE && this.currentPlayer !== this.config.playerColor) {
            // AI玩家使用策略指引，直接获得额外落子机会，不需要显示推荐位置
            this.addExtraMove(player, "策略指引", ItemType.STRATEGY_GUIDE);
            // 策略指引效果日志
            console.log(`策略指引：玩家 ${player} 获得额外 1 次落子机会`);
          } else {
            // 人类玩家使用策略指引，显示推荐位置并获得额外落子机会
            this.showStrategyGuide(player);
            this.addExtraMove(player, "策略指引", ItemType.STRATEGY_GUIDE);
            // 策略指引效果日志
            console.log(`策略指引：玩家 ${player} 获得额外 1 次落子机会，系统将推荐3个最优落子位置`);
          }
          // 确保使用正确的玩家来检查额外落子机会
          this.hasExtraMove = this.gameMoveCountState.players.get(originalCurrentPlayer)!.currentExtraMoves > 0;
        } finally {
          // 确保currentPlayer恢复正确
          this.currentPlayer = originalCurrentPlayer;
        }
        break;
      }
      case ItemType.TOUGHEN_HEART: {
        // 钢化我心：使玩家免疫下一次对手发起的移除类攻击
        this.addContinuousEffect(player, itemType, 1);
        // 钢化我心效果日志
        console.log(`钢化我心：玩家 ${player} 免疫「移除类」攻击次数加 1`);
        break;
      }
      case ItemType.SELF_MISTAKE: {
        // 自我失误：随机移除玩家自己的1颗棋子
        this.performSelfMistake(player);
        break;
      }
      case ItemType.OPPONENT_ACCELERATION: {
        // 对手加速：使对手在本回合获得额外1次落子机会，总共可以连续落子2颗
        this.nextPlayerHasExtraMove = true;
        // 对手加速效果日志
        console.log(`对手加速：玩家 ${player} 的对手获得额外 1 次落子机会`);
        break;
      }
      case ItemType.SLIP_PENALTY: {
        // 手滑惩罚：限制对手下一回合只能从系统随机给出的3个位置中选择1个落子
        // 无论当前玩家是否有加速落子效果，都保存到nextPlayerHasSlipPenalty
        // 在玩家切换时，会根据情况决定是否应用
        this.nextPlayerHasSlipPenalty = true;
        break;
      }
    }
  }

  /**
   * 执行混沌打击
   * @param player 玩家
   */
  private performChaosStrike(player: Player): void {
    const opponent = player === Player.BLACK ? Player.WHITE : Player.BLACK;

    // 检查对手是否有钢化我心效果
    const opponentActiveEffects = this.activeEffects.get(opponent) || [];
    const hasToughenHeart = opponentActiveEffects.some((effect) => effect.itemType === ItemType.TOUGHEN_HEART);

    if (hasToughenHeart) {
      // 移除钢化我心效果
      this.removeEffect(opponent, ItemType.TOUGHEN_HEART);
      const message = `${opponent === Player.BLACK ? "黑方" : "白方"} 使用「钢化我心」免疫了攻击！`;
      // 钢化我心抵挡攻击成功日志
      console.log(`钢化我心：玩家 ${opponent} 使用「钢化我心」抵挡了「混沌打击」`);
      this.showNotification(message, 3000); // 延长至3秒
      return;
    }

    const opponentStones: Position[] = [];
    const size = this.board.getSize();

    // 收集对手所有棋子位置
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pos = { x, y };
        if (this.board.getStone(pos) === opponent) {
          opponentStones.push(pos);
        }
      }
    }

    // 随机选择一个对手棋子并移除
    if (opponentStones.length > 0) {
      const randomIndex = Math.floor(Math.random() * opponentStones.length);
      const targetPosition = opponentStones[randomIndex];
      // 使用removeStone方法实际移除棋子
      this.board.removeStone(targetPosition);
      // 混沌打击效果日志
      console.log(`混沌打击：玩家 ${player} 的对手被随机移除 [${targetPosition.x}, ${targetPosition.y}] 位置的棋子`);
    }
  }

  /**
   * 执行自我失误
   * @param player 玩家
   */
  private performSelfMistake(player: Player): void {
    // 检查玩家是否有钢化我心效果
    const activeEffects = this.activeEffects.get(player) || [];
    const hasToughenHeart = activeEffects.some((effect) => effect.itemType === ItemType.TOUGHEN_HEART);

    if (hasToughenHeart) {
      // 移除钢化我心效果
      this.removeEffect(player, ItemType.TOUGHEN_HEART);
      const message = `${player === Player.BLACK ? "黑方" : "白方"} 使用「钢化我心」免疫了自己的失误！`;
      // 钢化我心抵挡攻击成功日志
      console.log(`钢化我心：玩家 ${player} 使用「钢化我心」抵挡了「自我失误」`);
      this.showNotification(message, 3000); // 延长至3秒
      return;
    }

    const playerStones: Position[] = [];
    const size = this.board.getSize();

    // 收集玩家所有棋子位置
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pos = { x, y };
        if (this.board.getStone(pos) === player) {
          playerStones.push(pos);
        }
      }
    }

    // 随机选择一个玩家棋子并移除
    if (playerStones.length > 0) {
      const randomIndex = Math.floor(Math.random() * playerStones.length);
      const targetPosition = playerStones[randomIndex];
      // 使用removeStone方法实际移除棋子
      this.board.removeStone(targetPosition);
      // 自我失误效果日志
      console.log(`自我失误：玩家 ${player} 被随机移除 [${targetPosition.x}, ${targetPosition.y}] 位置的棋子`);
    }
  }

  /**
   * 为AI玩家执行精准打击
   * @param player AI玩家
   */
  private performPreciseStrikeForAI(player: Player): void {
    const opponent = player === Player.BLACK ? Player.WHITE : Player.BLACK;

    // 收集对手所有棋子位置
    const opponentStones: Position[] = [];
    const size = this.board.getSize();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pos = { x, y };
        if (this.board.getStone(pos) === opponent) {
          opponentStones.push(pos);
        }
      }
    }

    if (opponentStones.length === 0) {
      return; // 没有可攻击的目标
    }

    // 检查对手是否有钢化我心效果
    const opponentActiveEffects = this.activeEffects.get(opponent) || [];
    const hasToughenHeart = opponentActiveEffects.some((effect) => effect.itemType === ItemType.TOUGHEN_HEART);

    if (hasToughenHeart) {
      // 移除钢化我心效果
      this.removeEffect(opponent, ItemType.TOUGHEN_HEART);
      const message = `${opponent === Player.BLACK ? "黑方" : "白方"} 使用「钢化我心」免疫了精准打击！`;
      console.log(`钢化我心：玩家 ${opponent} 使用「钢化我心」抵挡了「精准打击」`);
      this.showNotification(message, 3000);
    } else {
      // AI选择目标：这里可以实现更复杂的AI逻辑，比如选择最有价值的目标
      // 简单实现：随机选择一个目标
      const randomIndex = Math.floor(Math.random() * opponentStones.length);
      const targetPosition = opponentStones[randomIndex];

      // 移除对手棋子
      this.board.removeStone(targetPosition);
      // 精准打击效果日志
      console.log(`精准打击：玩家 ${player} 的对手被指定移除 [${targetPosition.x}, ${targetPosition.y}] 位置的棋子`);
    }
  }

  /**
   * 显示策略指引
   * @param player 玩家
   */
  private showStrategyGuide(player: Player): void {
    // 这里将实现策略指引逻辑，推荐3个最优落子位置
    this.strategyGuidePositions = [];
    this.gameSubState = GameSubState.SHOWING_STRATEGY_GUIDE;

    // 获取所有可用位置
    const availablePositions: Position[] = [];
    const size = this.board.getSize();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pos = { x, y };
        if (this.board.isEmpty(pos)) {
          availablePositions.push(pos);
        }
      }
    }

    if (availablePositions.length === 0) {
      return; // 没有可用位置
    }

    // 保存当前玩家，用于评估位置
    const originalPlayer = this.currentPlayer;
    this.currentPlayer = player; // 设置为触发方

    // 为每个可用位置评分
    const scoredPositions = availablePositions.map((pos) => {
      const score = this.evaluatePosition(pos);
      return { pos, score };
    });

    // 恢复原当前玩家
    this.currentPlayer = originalPlayer;

    // 按评分降序排序
    scoredPositions.sort((a, b) => b.score - a.score);

    // 选择前3个最高分的位置
    const topPositions = scoredPositions.slice(0, 3);
    this.strategyGuidePositions = topPositions.map((item) => item.pos);

    // 不再自动关闭策略指引，改为在落子后关闭
  }

  /**
   * 应用手滑惩罚
   */
  private applySlipPenalty(): void {
    this.allowedPositions = [];

    // 随机选择3个可用位置作为允许落子的位置
    const availablePositions: Position[] = [];
    const size = this.board.getSize();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pos = { x, y };
        if (this.board.isEmpty(pos)) {
          availablePositions.push(pos);
        }
      }
    }

    // 随机选择3个位置
    for (let i = 0; i < 3 && availablePositions.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      this.allowedPositions.push(availablePositions[randomIndex]);
      availablePositions.splice(randomIndex, 1);
    }
  }

  /**
   * 添加持续效果
   * @param player 玩家
   * @param itemType 道具类型
   * @param duration 持续时间（回合数）
   */
  private addContinuousEffect(player: Player, itemType: ItemType, duration: number): void {
    const playerItems = this.playerItems.get(player) || [];
    const newItem = {
      itemType,
      acquiredAt: Date.now(),
      activatedAt: Date.now(),
      expiresAt: Date.now() + duration * 1000 * 60, // 这里简化处理，实际应基于回合数
      isActive: true
    };
    playerItems.push(newItem);
    this.playerItems.set(player, playerItems);

    // 添加到激活效果列表
    const activeEffects = this.activeEffects.get(player) || [];
    activeEffects.push(newItem);
    this.activeEffects.set(player, activeEffects);
  }

  /**
   * 获取棋盘上的盲盒列表
   */
  getBlindBoxes(): BlindBox[] {
    return [...this.blindBoxes];
  }

  /**
   * 获取最后使用的道具
   */
  getLastItemUsed(): ItemType | null {
    return this.lastItemUsed;
  }

  /**
   * 获取游戏子状态
   */
  getGameSubState(): GameSubState {
    return this.gameSubState;
  }

  /**
   * 获取策略指引位置
   */
  getStrategyGuidePositions(): Position[] {
    return [...this.strategyGuidePositions];
  }

  /**
   * 获取玩家拥有的道具
   * @param player 玩家
   */
  getPlayerItems(player: Player): PlayerItem[] {
    return this.playerItems.get(player) || [];
  }

  /**
   * 获取当前激活的效果
   * @param player 玩家
   */
  getActiveEffects(player: Player): PlayerItem[] {
    return this.activeEffects.get(player) || [];
  }

  /**
   * 获取手滑惩罚时允许落子的位置
   */
  getAllowedPositions(): Position[] {
    return [...this.allowedPositions];
  }

  /**
   * 获取当前显示的提示信息
   */
  getNotification(): string | null {
    return this.notification;
  }

  /**
   * 获取精准打击的对手玩家
   */
  getPreciseStrikeOpponent(): Player | null {
    if (this.gameSubState === GameSubState.SELECTING_STRIKE_TARGET && this.preciseStrikePlayer) {
      return this.preciseStrikePlayer === Player.BLACK ? Player.WHITE : Player.BLACK;
    }
    return null;
  }

  /**
   * 显示提示信息
   * @param message 提示信息
   * @param duration 显示时长（毫秒）
   */
  private showNotification(message: string, duration: number = 2000): void {
    this.notification = message;

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }

    this.notificationTimer = setTimeout(() => {
      this.clearNotification();
    }, duration) as unknown as number;
  }

  /**
   * 清除提示信息
   */
  private clearNotification(): void {
    this.notification = null;
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
  }

  /**
   * 移除玩家的特定效果
   * @param player 玩家
   * @param itemType 道具类型
   */
  private removeEffect(player: Player, itemType: ItemType): void {
    // 从玩家道具列表中移除
    const playerItems = this.playerItems.get(player) || [];
    const updatedPlayerItems = playerItems.filter((item) => item.itemType !== itemType);
    this.playerItems.set(player, updatedPlayerItems);

    // 从激活效果列表中移除
    const activeEffects = this.activeEffects.get(player) || [];
    const updatedActiveEffects = activeEffects.filter((effect) => effect.itemType !== itemType);
    this.activeEffects.set(player, updatedActiveEffects);
  }

  /**
   * 评估指定位置的得分
   * @param position 要评估的位置
   * @returns 位置得分
   */
  private evaluatePosition(position: Position): number {
    const aiColor = this.currentPlayer;
    const playerColor = aiColor === Player.BLACK ? Player.WHITE : Player.BLACK;

    let score = 0;

    // 检查四个方向：横向、纵向、对角线1、对角线2
    const directions = [
      { dx: 1, dy: 0 }, // 横向
      { dx: 0, dy: 1 }, // 纵向
      { dx: 1, dy: 1 }, // 对角线1（右上到左下）
      { dx: 1, dy: -1 } // 对角线2（左上到右下）
    ];

    directions.forEach((dir) => {
      // 评估AI在该方向的得分
      score += this.evaluateDirection(position, aiColor, dir.dx, dir.dy);
      // 评估玩家在该方向的得分（防守）
      score += this.evaluateDirection(position, playerColor, dir.dx, dir.dy);
    });

    // 中心位置加成
    const size = this.board.getSize();
    const centerX = Math.floor(size / 2);
    const centerY = Math.floor(size / 2);
    const distanceFromCenter = Math.abs(position.x - centerX) + Math.abs(position.y - centerY);
    score += (10 - distanceFromCenter) * 2; // 距离中心越近，分数越高

    return score;
  }

  /**
   * 评估指定方向的得分
   * @param position 起始位置
   * @param player 玩家
   * @param dx x方向增量
   * @param dy y方向增量
   * @returns 方向得分
   */
  private evaluateDirection(position: Position, player: Player, dx: number, dy: number): number {
    const size = this.board.getSize();
    let count = 1; // 当前位置的棋子
    let openEnds = 0; // 开放端数量

    // 检查正方向
    let x = position.x + dx;
    let y = position.y + dy;
    while (x >= 0 && x < size && y >= 0 && y < size && this.board.getStone({ x, y }) === player) {
      count++;
      x += dx;
      y += dy;
    }
    // 检查正方向是否是开放端
    if (x >= 0 && x < size && y >= 0 && y < size && this.board.isEmpty({ x, y })) {
      openEnds++;
    }

    // 检查反方向
    x = position.x - dx;
    y = position.y - dy;
    while (x >= 0 && x < size && y >= 0 && y < size && this.board.getStone({ x, y }) === player) {
      count++;
      x -= dx;
      y -= dy;
    }
    // 检查反方向是否是开放端
    if (x >= 0 && x < size && y >= 0 && y < size && this.board.isEmpty({ x, y })) {
      openEnds++;
    }

    // 根据连珠数量和开放端数量计算得分
    return this.calculateScore(count, openEnds);
  }

  /**
   * 根据连珠数量和开放端数量计算得分
   * @param count 连珠数量
   * @param openEnds 开放端数量
   * @returns 得分
   */
  private calculateScore(count: number, openEnds: number): number {
    // 评分规则：
    // 五子连珠：最高优先级
    // 四连珠（无阻挡）：高优先级
    // 四连珠（一端阻挡）：中高优先级
    // 三连珠（无阻挡）：中优先级
    // 三连珠（一端阻挡）：中低优先级
    // 二连珠：低优先级

    switch (count) {
      case 5:
        return 1000000; // 五子连珠，必胜
      case 4:
        if (openEnds === 2) {
          return 100000; // 四连珠，无阻挡，极高优先级
        } else if (openEnds === 1) {
          return 10000; // 四连珠，一端阻挡，高优先级
        }
        break;
      case 3:
        if (openEnds === 2) {
          return 1000; // 三连珠，无阻挡，中高优先级
        } else if (openEnds === 1) {
          return 100; // 三连珠，一端阻挡，中优先级
        }
        break;
      case 2:
        if (openEnds === 2) {
          return 10; // 二连珠，无阻挡，低优先级
        } else if (openEnds === 1) {
          return 5; // 二连珠，一端阻挡，极低优先级
        }
        break;
      case 1:
        return 1; // 单珠，最低优先级
    }

    return 0;
  }

  /**
   * 检查是否获胜
   * @param position 最后落子位置
   * @param player 玩家
   * @returns 游戏结果
   */
  private checkWin(position: Position, player: Player): GameResult {
    // 检查方向：横向、纵向、对角线1、对角线2
    const directions = [
      { dx: 1, dy: 0 }, // 横向
      { dx: 0, dy: 1 }, // 纵向
      { dx: 1, dy: 1 }, // 对角线1（右上到左下）
      { dx: 1, dy: -1 } // 对角线2（左上到右下）
    ];

    for (const dir of directions) {
      const winningLine = this.checkDirection(position, player, dir.dx, dir.dy);
      if (winningLine.length >= 5) {
        return {
          winner: player,
          winningLine
        };
      }
    }

    return {
      winner: null,
      winningLine: []
    };
  }

  /**
   * 检查指定方向的连珠情况
   * @param position 起始位置
   * @param player 玩家
   * @param dx x方向增量
   * @param dy y方向增量
   * @returns 连珠位置数组
   */
  private checkDirection(position: Position, player: Player, dx: number, dy: number): Position[] {
    const line: Position[] = [position];

    // 向正方向检查
    let x = position.x + dx;
    let y = position.y + dy;
    while (this.board.isValidPosition({ x, y }) && this.board.getStone({ x, y }) === player) {
      line.push({ x, y });
      x += dx;
      y += dy;
    }

    // 向反方向检查
    x = position.x - dx;
    y = position.y - dy;
    while (this.board.isValidPosition({ x, y }) && this.board.getStone({ x, y }) === player) {
      line.unshift({ x, y });
      x -= dx;
      y -= dy;
    }

    return line;
  }

  /**
   * 悔棋
   * @returns 是否悔棋成功
   */
  undoMove(): boolean {
    if (this.gameState === GameState.READY || this.moveHistory.length === 0) {
      return false;
    }

    // 停止任何正在进行的AI计算
    if (this.isAiCalculating && this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
      this.isAiCalculating = false;
    }

    // 只针对PVE模式进行特殊处理
    if (this.config.mode === GameMode.PVE) {
      // 检查电脑是否已落子
      const lastMove = this.moveHistory[this.moveHistory.length - 1];
      const isComputerMove = lastMove.player !== this.config.playerColor;

      // 情况1：电脑已落子，需要撤回两步（电脑+玩家）
      if (isComputerMove && this.moveHistory.length >= 2) {
        // 撤回电脑落子
        this.board.undoMove();
        this.moveHistory.pop();

        // 撤回玩家落子
        this.board.undoMove();
        this.moveHistory.pop();
      } else {
        // 情况2：玩家刚落子，只需要撤回一步
        // 撤回玩家落子
        this.board.undoMove();
        this.moveHistory.pop();
      }

      // PVE模式悔棋后，当前玩家必须是人类玩家
      // 确保玩家可以继续下棋，不会出现当前玩家是电脑的情况
      this.currentPlayer = this.config.playerColor;
    } else {
      // PVP模式：正常悔棋逻辑
      // 撤回当前落子
      this.board.undoMove();
      this.moveHistory.pop();
      this.currentPlayer = this.currentPlayer === Player.BLACK ? Player.WHITE : Player.BLACK;
    }

    // 重置游戏状态
    this.gameState = GameState.PLAYING;
    this.gameResult = null;

    // 重置道具相关状态
    this.gameSubState = GameSubState.NORMAL;
    this.strategyGuidePositions = [];
    this.allowedPositions = [];
    this.preciseStrikePlayer = null;
    this.preciseStrikeHasExtraMove = false;

    return true;
  }

  /**
   * 重新开始游戏
   */
  restart(): void {
    this.startNewGame();
  }

  /**
   * 获取落子历史记录
   */
  getMoveHistory(): Move[] {
    return [...this.moveHistory];
  }

  /**
   * 暂停游戏
   */
  pause(): void {
    if (this.gameState === GameState.PLAYING) {
      this.gameState = GameState.PAUSED;
    }
  }

  /**
   * 继续游戏
   */
  resume(): void {
    if (this.gameState === GameState.PAUSED) {
      this.gameState = GameState.PLAYING;
    }
  }

  /**
   * 获取指定玩家的落子计数
   * @param player 玩家
   * @returns 玩家落子计数
   */
  getPlayerMoveCount(player: Player): PlayerMoveCount {
    const moveCount = this.gameMoveCountState.players.get(player)!;
    return {
      ...moveCount,
      moveEvents: [...moveCount.moveEvents] // 返回事件副本，避免外部修改
    };
  }

  /**
   * 获取当前玩家的落子计数
   * @returns 当前玩家落子计数
   */
  getCurrentPlayerMoveCount(): PlayerMoveCount {
    return this.getPlayerMoveCount(this.currentPlayer);
  }

  /**
   * 获取落子事件历史记录
   * @returns 落子事件历史记录（按时间排序）
   */
  getMoveHistoryEvents(): MoveEvent[] {
    const allEvents: MoveEvent[] = [];

    for (const [_, moveCount] of this.gameMoveCountState.players) {
      allEvents.push(...moveCount.moveEvents);
    }

    // 按时间戳排序
    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 获取玩家剩余的额外落子次数
   * @param player 玩家
   * @returns 剩余额外落子次数
   */
  getPlayerRemainingExtraMoves(player: Player): number {
    return this.gameMoveCountState.players.get(player)!.currentExtraMoves;
  }

  /**
   * 设置棋盘大小
   * @param size 棋盘大小
   */
  setBoardSize(size: BoardSize): void {
    // 清理AI定时器
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    this.isAiCalculating = false;

    this.board = new Board(size);
    this.startNewGame();
    this.notifyGameStateChange(); // 通知UI更新
  }

  /**
   * 注册游戏状态变化回调
   * @param callback 回调函数
   */
  onGameStateChange(callback: GameStateChangeCallback): void {
    this.gameStateChangeCallbacks.push(callback);
  }

  /**
   * 移除游戏状态变化回调
   * @param callback 回调函数
   */
  offGameStateChange(callback: GameStateChangeCallback): void {
    this.gameStateChangeCallbacks = this.gameStateChangeCallbacks.filter((cb) => cb !== callback);
  }

  /**
   * 触发游戏状态变化回调
   */
  private notifyGameStateChange(): void {
    this.gameStateChangeCallbacks.forEach((callback) => callback());
  }

}