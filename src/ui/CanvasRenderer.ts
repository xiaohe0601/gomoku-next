import type { GomokuGame } from "../game/GomokuGame";
import { ITEM_INFO_MAP } from "../game/ItemSystem";
import { Stone } from "../game/Stone";
import { GameSubState } from "../game/types";
import type { Position } from "../game/types";
import type { GameUI } from "./GameUI";

export class CanvasRenderer {

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private game: GomokuGame;
  private gameUI: GameUI | null = null;
  private cellSize: number = 30;
  private margin: number = 20;
  private stones: Stone[] = [];
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private hoverPosition: Position | null = null;

  /**
   * 构造函数
   * @param canvas Canvas元素
   * @param game 游戏实例
   */
  constructor(canvas: HTMLCanvasElement, game: GomokuGame) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.game = game;

    // 初始化Canvas
    this.initializeCanvas();
    // 绑定事件
    this.bindEvents();
    // 开始渲染循环
    this.startRenderLoop();
  }

  /**
   * 初始化Canvas
   */
  private initializeCanvas(): void {
    const size = this.game.getBoard().getSize();
    const canvasSize = this.margin * 2 + this.cellSize * (size - 1);

    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    this.canvas.style.touchAction = "none"; // 防止触摸设备上的默认行为
  }

  /**
   * 绑定事件监听器
   */
  private bindEvents(): void {
    // 鼠标事件
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("click", this.handleClick.bind(this));
    this.canvas.addEventListener("mouseleave", this.handleMouseLeave.bind(this));

    // 触摸事件
    this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: true });
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: true });
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this), { passive: true });
  }

  /**
   * 将屏幕坐标转换为棋盘坐标
   * @param screenX 屏幕X坐标
   * @param screenY 屏幕Y坐标
   */
  private screenToBoard(screenX: number, screenY: number): Position {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round((screenX - rect.left - this.margin) / this.cellSize);
    const y = Math.round((screenY - rect.top - this.margin) / this.cellSize);
    return { x, y };
  }

  /**
   * 将棋盘坐标转换为屏幕坐标
   * @param boardX 棋盘X坐标
   * @param boardY 棋盘Y坐标
   */
  private boardToScreen(boardX: number, boardY: number): Position {
    return {
      x: this.margin + boardX * this.cellSize,
      y: this.margin + boardY * this.cellSize
    };
  }

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove(event: MouseEvent): void {
    const boardPos = this.screenToBoard(event.clientX, event.clientY);
    const size = this.game.getBoard().getSize();

    // 检查是否在棋盘范围内
    if (boardPos.x >= 0 && boardPos.x < size && boardPos.y >= 0 && boardPos.y < size) {
      this.hoverPosition = boardPos;
    } else {
      this.hoverPosition = null;
    }
  }

  /**
   * 处理鼠标点击事件
   */
  private handleClick(event: MouseEvent): void {
    const boardPos = this.screenToBoard(event.clientX, event.clientY);
    this.game.makeMove(boardPos);

    // 落子后更新UI
    if (this.gameUI) {
      this.gameUI.updateUI();
    }
  }

  /**
   * 处理鼠标离开事件
   */
  private handleMouseLeave(): void {
    this.hoverPosition = null;
  }

  /**
   * 处理触摸开始事件
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const boardPos = this.screenToBoard(touch.clientX, touch.clientY);
    this.hoverPosition = boardPos;
  }

  /**
   * 处理触摸移动事件
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const boardPos = this.screenToBoard(touch.clientX, touch.clientY);
    this.hoverPosition = boardPos;
  }

  /**
   * 处理触摸结束事件
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    if (this.hoverPosition) {
      this.game.makeMove(this.hoverPosition);

      // 落子后更新UI
      if (this.gameUI) {
        this.gameUI.updateUI();
      }
    }
  }

  /**
   * 绘制棋盘
   */
  private drawBoard(): void {
    const size = this.game.getBoard().getSize();

    // 清空画布
    this.ctx.fillStyle = "#F5DEB3"; // 棋盘背景色
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制网格线
    this.ctx.strokeStyle = "#000000";
    this.ctx.lineWidth = 1;

    for (let i = 0; i < size; i++) {
      // 横线
      this.ctx.beginPath();
      this.ctx.moveTo(this.margin, this.margin + i * this.cellSize);
      this.ctx.lineTo(this.margin + (size - 1) * this.cellSize, this.margin + i * this.cellSize);
      this.ctx.stroke();

      // 竖线
      this.ctx.beginPath();
      this.ctx.moveTo(this.margin + i * this.cellSize, this.margin);
      this.ctx.lineTo(this.margin + i * this.cellSize, this.margin + (size - 1) * this.cellSize);
      this.ctx.stroke();
    }

    // 绘制星位点（天元和星位）
    this.drawStarPoints();
  }

  /**
   * 绘制星位点
   */
  private drawStarPoints(): void {
    const size = this.game.getBoard().getSize();
    const starPoints: Position[] = [];

    if (size === 15) {
      // 15×15棋盘的星位点
      const starPositions = [3, 7, 11];
      starPositions.forEach((x) => {
        starPositions.forEach((y) => {
          starPoints.push({ x, y });
        });
      });
    } else if (size === 19) {
      // 19×19棋盘的星位点
      const starPositions = [3, 9, 15];
      starPositions.forEach((x) => {
        starPositions.forEach((y) => {
          starPoints.push({ x, y });
        });
      });
    }

    // 绘制星位点
    this.ctx.fillStyle = "#000000";
    starPoints.forEach((pos) => {
      const screenPos = this.boardToScreen(pos.x, pos.y);
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  /**
   * 绘制棋子
   */
  private drawStones(): void {
    const board = this.game.getBoard();
    const size = board.getSize();

    // 清空现有棋子
    this.stones = [];

    // 绘制棋盘上的所有棋子
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const player = board.getStone({ x, y });
        if (player) {
          const screenPos = this.boardToScreen(x, y);
          const stone = new Stone(screenPos, player, this.cellSize / 2 - 2);
          this.stones.push(stone);
          this.drawStone(stone);
        }
      }
    }

    // 绘制悬停指示器
    this.drawHoverIndicator();

    // 绘制获胜连线
    this.drawWinningLine();

    // 绘制盲盒
    this.drawBlindBoxes();

    // 绘制策略指引
    this.drawStrategyGuide();

    // 绘制手滑惩罚允许落子的位置
    this.drawSlipPenalty();

    // 绘制精准打击选择模式
    this.drawPreciseStrikeMode();
  }

  /**
   * 绘制盲盒
   */
  private drawBlindBoxes(): void {
    const blindBoxes = this.game.getBlindBoxes();

    blindBoxes.forEach((box) => {
      if (!box.isOpened) {
        const screenPos = this.boardToScreen(box.position.x, box.position.y);

        // 绘制盲盒外框
        this.ctx.save();
        this.ctx.fillStyle = "rgba(255, 215, 0, 0.8)"; // 金色半透明
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, this.cellSize / 2 - 2, 0, Math.PI * 2);
        this.ctx.fill();

        // 绘制盲盒图案
        this.ctx.fillStyle = "#FF4500"; // 橙红色
        this.ctx.font = `${this.cellSize / 2}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("🎁", screenPos.x, screenPos.y);

        this.ctx.restore();
      }
    });
  }

  /**
   * 绘制策略指引
   */
  private drawStrategyGuide(): void {
    const gameSubState = this.game.getGameSubState();
    if (gameSubState === GameSubState.SHOWING_STRATEGY_GUIDE) {
      const guidePositions = this.game.getStrategyGuidePositions();

      guidePositions.forEach((pos) => {
        const screenPos = this.boardToScreen(pos.x, pos.y);

        // 绘制策略指引标记
        this.ctx.save();
        this.ctx.strokeStyle = "#00FF00"; // 绿色
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, this.cellSize / 2, 0, Math.PI * 2);
        this.ctx.stroke();

        // 绘制指引序号
        this.ctx.fillStyle = "#00FF00";
        this.ctx.font = `${this.cellSize / 3}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText((guidePositions.indexOf(pos) + 1).toString(), screenPos.x, screenPos.y);

        this.ctx.restore();
      });
    }
  }

  /**
   * 绘制手滑惩罚允许落子的位置
   */
  private drawSlipPenalty(): void {
    const allowedPositions = this.game.getAllowedPositions();
    if (allowedPositions.length === 0) {
      return;
    }

    allowedPositions.forEach((pos) => {
      const screenPos = this.boardToScreen(pos.x, pos.y);

      // 绘制允许落子的位置标记
      this.ctx.save();
      this.ctx.strokeStyle = "#FFA500"; // 橙色
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([3, 3]);
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, this.cellSize / 2, 0, Math.PI * 2);
      this.ctx.stroke();

      // 绘制中心标记
      this.ctx.fillStyle = "#FFA500";
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  /**
   * 绘制精准打击选择模式
   */
  private drawPreciseStrikeMode(): void {
    const gameSubState = this.game.getGameSubState();
    if (gameSubState === GameSubState.SELECTING_STRIKE_TARGET) {
      const board = this.game.getBoard();
      const size = board.getSize();

      // 获取精准打击的对手玩家
      const opponent = this.game.getPreciseStrikeOpponent();
      if (!opponent) {
        return;
      }

      // 绘制所有对手棋子的选择框
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const pos = { x, y };
          const stone = board.getStone(pos);

          // 确保只高亮对手的棋子
          if (stone === opponent) {
            const screenPos = this.boardToScreen(x, y);

            this.ctx.save();
            this.ctx.strokeStyle = "#FF0000"; // 红色
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([2, 2]);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, this.cellSize / 2 + 5, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
          }
        }
      }

      // 绘制提示文字
      this.ctx.save();
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.fillRect(
        this.canvas.width / 2 - 150,
        this.canvas.height - 60,
        300,
        40
      );

      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.font = "16px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("点击选择要移除的对手棋子", this.canvas.width / 2, this.canvas.height - 40);
      this.ctx.restore();
    }
  }

  /**
   * 绘制提示信息
   */
  private drawNotification(): void {
    const notification = this.game.getNotification();
    if (!notification) {
      return;
    }

    // 绘制提示信息背景（调整到屏幕顶部，避免与道具名称显示重合）
    this.ctx.save();
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(
      this.canvas.width / 2 - 150,
      50, // 调整到屏幕顶部
      300,
      60
    );

    // 绘制提示信息文字
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.font = "bold 18px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(notification, this.canvas.width / 2, 80); // 调整文字位置
    this.ctx.restore();
  }

  /**
   * 绘制道具名称显示
   */
  private drawItemName(): void {
    const gameSubState = this.game.getGameSubState();
    if (gameSubState === GameSubState.SHOWING_ITEM_NAME) {
      const lastItemUsed = this.game.getLastItemUsed();
      if (lastItemUsed) {
        const itemInfo = ITEM_INFO_MAP[lastItemUsed];

        // 绘制道具名称背景
        this.ctx.save();
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(
          this.canvas.width / 2 - 100,
          this.canvas.height / 2 - 25,
          200,
          50
        );

        // 绘制道具名称
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.font = "bold 20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(itemInfo.name, this.canvas.width / 2, this.canvas.height / 2);

        this.ctx.restore();
      }
    }
  }

  /**
   * 绘制单个棋子
   * @param stone 棋子对象
   */
  private drawStone(stone: Stone): void {
    const pos = stone.getPosition();
    const radius = stone.getRadius();
    const scale = stone.getAnimationScale();

    // 保存当前上下文状态
    this.ctx.save();

    // 应用缩放变换
    this.ctx.translate(pos.x, pos.y);
    this.ctx.scale(scale, scale);

    // 绘制棋子主体
    this.ctx.fillStyle = stone.getColor();
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // 绘制棋子边框
    this.ctx.strokeStyle = "#000000";
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // 绘制棋子高光
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    this.ctx.beginPath();
    this.ctx.arc(-radius / 3, -radius / 3, radius / 3, 0, Math.PI * 2);
    this.ctx.fill();

    // 恢复上下文状态
    this.ctx.restore();
  }

  /**
   * 绘制悬停指示器
   */
  private drawHoverIndicator(): void {
    if (!this.hoverPosition || this.game.getGameState() !== "playing") {
      return;
    }

    const board = this.game.getBoard();
    if (!board.isEmpty(this.hoverPosition)) {
      return;
    }

    const screenPos = this.boardToScreen(this.hoverPosition.x, this.hoverPosition.y);

    // 绘制半透明的悬停指示器
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, this.cellSize / 2 - 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * 绘制获胜连线
   */
  private drawWinningLine(): void {
    const result = this.game.getGameResult();
    if (!result || !result.winner || result.winningLine.length < 5) {
      return;
    }

    // 绘制获胜连线
    this.ctx.strokeStyle = "#FF0000";
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    result.winningLine.forEach((pos, index) => {
      const screenPos = this.boardToScreen(pos.x, pos.y);
      if (index === 0) {
        this.ctx.moveTo(screenPos.x, screenPos.y);
      } else {
        this.ctx.lineTo(screenPos.x, screenPos.y);
      }
    });
    this.ctx.stroke();

    // 重置线条样式
    this.ctx.setLineDash([]);
  }

  /**
   * 更新动画
   * @param deltaTime 时间增量（毫秒）
   */
  private updateAnimations(deltaTime: number): void {
    this.stones.forEach((stone) => {
      stone.updateAnimation(deltaTime);
    });
  }

  /**
   * 渲染一帧
   * @param currentTime 当前时间（毫秒）
   */
  private render(currentTime: number): void {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // 更新动画
    this.updateAnimations(deltaTime);

    // 绘制棋盘
    this.drawBoard();

    // 绘制棋子
    this.drawStones();

    // 绘制道具名称显示
    this.drawItemName();

    // 绘制提示信息
    this.drawNotification();

    // 继续渲染循环
    this.animationFrameId = requestAnimationFrame(this.render.bind(this));
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop(): void {
    this.animationFrameId = requestAnimationFrame(this.render.bind(this));
  }

  /**
   * 停止渲染循环
   */
  public stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 设置棋盘大小
   */
  public resizeBoard(): void {
    this.initializeCanvas();
  }

  /**
   * 设置GameUI引用
   * @param gameUI GameUI实例
   */
  public setGameUI(gameUI: GameUI): void {
    this.gameUI = gameUI;
  }

  /**
   * 销毁渲染器，清理资源
   */
  public destroy(): void {
    this.stopRenderLoop();
    // 移除事件监听器
    this.canvas.removeEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.removeEventListener("click", this.handleClick.bind(this));
    this.canvas.removeEventListener("mouseleave", this.handleMouseLeave.bind(this));
    this.canvas.removeEventListener("touchstart", this.handleTouchStart.bind(this));
    this.canvas.removeEventListener("touchmove", this.handleTouchMove.bind(this));
    this.canvas.removeEventListener("touchend", this.handleTouchEnd.bind(this));
  }

}