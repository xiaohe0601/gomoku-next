import type { GomokuGame } from "../game/GomokuGame";
import { ITEM_INFO_MAP } from "../game/ItemSystem";
import { GameMode, GameState, Player } from "../game/types";
import type { CanvasRenderer } from "./CanvasRenderer";

export class GameUI {

  private game: GomokuGame;
  private renderer: CanvasRenderer;
  private container: HTMLElement;
  private gameInfoContainer: HTMLElement;
  private gameInfoElement: HTMLElement | undefined;
  private currentPlayerElement: HTMLElement | undefined;
  private gameStateElement: HTMLElement | undefined;
  private controlsElement: HTMLElement | undefined;
  private itemToggle: HTMLInputElement | null = null;

  /**
   * 构造函数
   * @param container 容器元素
   * @param game 游戏实例
   * @param renderer Canvas渲染器
   * @param gameInfoContainer 游戏信息容器
   */
  constructor(container: HTMLElement, game: GomokuGame, renderer: CanvasRenderer, gameInfoContainer: HTMLElement) {
    this.game = game;
    this.renderer = renderer;
    this.container = container;
    this.gameInfoContainer = gameInfoContainer;

    // 创建UI元素
    this.createUI();
    // 绑定事件
    this.bindEvents();
    // 注册游戏状态变化回调
    this.game.onGameStateChange(() => this.updateUI());
    // 更新UI
    this.updateUI();
  }

  /**
   * 创建UI元素
   */
  private createUI(): void {
    // 清空容器
    this.container.innerHTML = "";

    // 创建游戏信息区域
    this.gameInfoElement = document.createElement("div");
    this.gameInfoElement.className = "game-info";

    // 当前玩家显示
    this.currentPlayerElement = document.createElement("div");
    this.currentPlayerElement.className = "current-player";
    this.gameInfoElement.appendChild(this.currentPlayerElement);

    // 游戏状态显示
    this.gameStateElement = document.createElement("div");
    this.gameStateElement.className = "game-state";
    this.gameInfoElement.appendChild(this.gameStateElement);

    // 创建控制区域
    this.controlsElement = document.createElement("div");
    this.controlsElement.className = "game-controls";

    // 游戏模式选择
    const modeContainer = document.createElement("div");
    modeContainer.className = "mode-selector";

    const pvpButton = document.createElement("button");
    pvpButton.id = "mode-pvp";
    pvpButton.textContent = "玩家 VS 玩家";
    modeContainer.appendChild(pvpButton);

    const pveButton = document.createElement("button");
    pveButton.id = "mode-pve";
    pveButton.textContent = "玩家 VS 电脑";
    modeContainer.appendChild(pveButton);

    this.controlsElement.appendChild(modeContainer);

    // 玩家颜色选择（仅PVE模式下显示）
    const colorContainer = document.createElement("div");
    colorContainer.id = "color-selector";
    colorContainer.className = "color-selector";

    const blackButton = document.createElement("button");
    blackButton.id = "color-black";
    blackButton.textContent = "黑棋（先手）";
    colorContainer.appendChild(blackButton);

    const whiteButton = document.createElement("button");
    whiteButton.id = "color-white";
    whiteButton.textContent = "白棋（后手）";
    colorContainer.appendChild(whiteButton);

    this.controlsElement.appendChild(colorContainer);

    // 初始化选中状态
    this.updateModeUI();
    this.updateColorUI();

    // 悔棋按钮
    const undoButton = document.createElement("button");
    undoButton.id = "undo-move";
    undoButton.textContent = "悔棋";
    this.controlsElement.appendChild(undoButton);

    // 重新开始按钮
    const restartButton = document.createElement("button");
    restartButton.id = "restart-game";
    restartButton.textContent = "重新开始";
    this.controlsElement.appendChild(restartButton);

    // 棋盘大小选择
    const boardSizeContainer = document.createElement("div");
    boardSizeContainer.className = "board-size-selector";

    const sizeLabel = document.createElement("label");
    sizeLabel.textContent = "棋盘大小: ";
    boardSizeContainer.appendChild(sizeLabel);

    const size15Button = document.createElement("button");
    size15Button.id = "size-15";
    size15Button.textContent = "15×15";
    boardSizeContainer.appendChild(size15Button);

    const size19Button = document.createElement("button");
    size19Button.id = "size-19";
    size19Button.textContent = "19×19";
    boardSizeContainer.appendChild(size19Button);

    this.controlsElement.appendChild(boardSizeContainer);

    // 道具开关
    const itemToggleContainer = document.createElement("div");
    itemToggleContainer.className = "item-toggle-container";

    const itemToggleLabel = document.createElement("label");
    itemToggleLabel.textContent = "启用道具系统: ";
    itemToggleLabel.htmlFor = "item-toggle";

    this.itemToggle = document.createElement("input");
    this.itemToggle.type = "checkbox";
    this.itemToggle.id = "item-toggle";
    this.itemToggle.checked = this.game.getConfig().enableItems;
    this.itemToggle.addEventListener("change", () => {
      this.game.setConfig({ enableItems: this.itemToggle!.checked });
      this.updateUI();
    });

    itemToggleContainer.appendChild(itemToggleLabel);
    itemToggleContainer.appendChild(this.itemToggle);
    this.controlsElement.appendChild(itemToggleContainer);

    // 添加游戏信息到游戏信息容器（棋盘上方）
    this.gameInfoContainer.appendChild(this.gameInfoElement);

    // 添加其他UI元素到容器
    this.container.appendChild(this.controlsElement);

    // 添加状态栏容器
    const statusBarsContainer = document.createElement("div");
    statusBarsContainer.className = "status-bars-container";

    // 添加黑方状态栏
    const blackStatusBar = document.createElement("div");
    blackStatusBar.id = "black-status-bar";
    blackStatusBar.className = "status-bar";
    blackStatusBar.innerHTML = "<div class=\"status-bar-title\">黑方状态</div>";
    statusBarsContainer.appendChild(blackStatusBar);

    // 添加白方状态栏
    const whiteStatusBar = document.createElement("div");
    whiteStatusBar.id = "white-status-bar";
    whiteStatusBar.className = "status-bar";
    whiteStatusBar.innerHTML = "<div class=\"status-bar-title\">白方状态</div>";
    statusBarsContainer.appendChild(whiteStatusBar);

    this.container.appendChild(statusBarsContainer);

    // 添加道具说明按钮
    const itemInfoButton = document.createElement("button");
    itemInfoButton.id = "item-info-button";
    itemInfoButton.textContent = "❔";
    itemInfoButton.title = "道具说明";
    itemInfoButton.className = "item-info-button";
    this.container.appendChild(itemInfoButton);

    // 添加道具说明弹窗
    this.createItemInfoPopup();

    // 初始化UI状态
    this.updateModeUI();

    // 绑定道具说明按钮事件
    itemInfoButton.addEventListener("click", this.toggleItemInfoPopup.bind(this));
  }

  /**
   * 创建道具说明弹窗
   */
  private createItemInfoPopup(): void {
    // 创建弹窗容器
    const popup = document.createElement("div");
    popup.id = "item-info-popup";
    popup.className = "item-info-popup hidden";

    // 创建弹窗标题
    const title = document.createElement("h3");
    title.textContent = "道具说明";
    popup.appendChild(title);

    // 创建道具列表
    const itemList = document.createElement("div");
    itemList.className = "item-list";

    // 按类别分组显示道具
    const strengtheningItems = Object.values(ITEM_INFO_MAP).filter((item) => item.isStrengthening);
    const weakeningItems = Object.values(ITEM_INFO_MAP).filter((item) => !item.isStrengthening);

    // 强化类道具
    const strengtheningSection = this.createItemSection("强化类道具", strengtheningItems);
    itemList.appendChild(strengtheningSection);

    // 弱化类道具
    const weakeningSection = this.createItemSection("弱化类道具", weakeningItems);
    itemList.appendChild(weakeningSection);

    popup.appendChild(itemList);

    // 创建关闭按钮
    const closeButton = document.createElement("button");
    closeButton.id = "close-popup";
    closeButton.textContent = "关闭";
    closeButton.addEventListener("click", this.toggleItemInfoPopup.bind(this));
    popup.appendChild(closeButton);

    // 添加到文档
    document.body.appendChild(popup);
  }

  /**
   * 创建道具分类区域
   * @param title 区域标题
   * @param items 道具列表
   */
  private createItemSection(title: string, items: typeof ITEM_INFO_MAP[keyof typeof ITEM_INFO_MAP][]): HTMLElement {
    const section = document.createElement("div");
    section.className = "item-section";

    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "items-container";

    items.forEach((item) => {
      const itemElement = document.createElement("div");
      itemElement.className = "item-info-item";

      // 道具图标和名称
      const itemHeader = document.createElement("div");
      itemHeader.className = "item-header";
      itemHeader.innerHTML = `<span class="item-icon">${item.icon}</span><span class="item-name">${item.name}</span>`;
      itemElement.appendChild(itemHeader);

      // 道具描述
      const itemDesc = document.createElement("div");
      itemDesc.className = "item-description";
      itemDesc.textContent = item.description;
      itemElement.appendChild(itemDesc);

      itemsContainer.appendChild(itemElement);
    });

    section.appendChild(itemsContainer);
    return section;
  }

  /**
   * 切换道具说明弹窗显示
   */
  private toggleItemInfoPopup(): void {
    const popup = document.getElementById("item-info-popup");
    if (popup) {
      popup.classList.toggle("hidden");
    }
  }

  /**
   * 更新状态栏
   */
  private updateStatusBar(): void {
    // 获取黑方状态栏
    const blackStatusBar = document.getElementById("black-status-bar");
    if (!blackStatusBar) {
      return;
    }

    // 获取白方状态栏
    const whiteStatusBar = document.getElementById("white-status-bar");
    if (!whiteStatusBar) {
      return;
    }

    // 获取或创建黑方状态内容容器
    let blackContent = blackStatusBar.querySelector(".status-bar-content") as HTMLElement;
    if (!blackContent) {
      blackContent = document.createElement("div");
      blackContent.className = "status-bar-content";
      blackStatusBar.appendChild(blackContent);
    } else {
      // 清空内容但保留元素，避免反复创建和移除
      blackContent.innerHTML = "";
    }

    // 获取或创建白方状态内容容器
    let whiteContent = whiteStatusBar.querySelector(".status-bar-content") as HTMLElement;
    if (!whiteContent) {
      whiteContent = document.createElement("div");
      whiteContent.className = "status-bar-content";
      whiteStatusBar.appendChild(whiteContent);
    } else {
      // 清空内容但保留元素，避免反复创建和移除
      whiteContent.innerHTML = "";
    }

    // 更新黑方状态栏
    const blackActiveEffects = this.game.getActiveEffects(Player.BLACK);
    blackActiveEffects.forEach((effect) => {
      const itemInfo = ITEM_INFO_MAP[effect.itemType];

      const effectElement = document.createElement("div");
      effectElement.className = "status-effect";
      effectElement.title = `${itemInfo.name}: ${itemInfo.description}`;

      // 道具图标
      const iconElement = document.createElement("span");
      iconElement.className = "effect-icon";
      iconElement.textContent = itemInfo.icon;
      effectElement.appendChild(iconElement);

      // 道具名称
      const nameElement = document.createElement("span");
      nameElement.className = "effect-name";
      nameElement.textContent = itemInfo.name;
      effectElement.appendChild(nameElement);

      blackContent.appendChild(effectElement);
    });

    // 更新白方状态栏
    const whiteActiveEffects = this.game.getActiveEffects(Player.WHITE);
    whiteActiveEffects.forEach((effect) => {
      const itemInfo = ITEM_INFO_MAP[effect.itemType];

      const effectElement = document.createElement("div");
      effectElement.className = "status-effect";
      effectElement.title = `${itemInfo.name}: ${itemInfo.description}`;

      // 道具图标
      const iconElement = document.createElement("span");
      iconElement.className = "effect-icon";
      iconElement.textContent = itemInfo.icon;
      effectElement.appendChild(iconElement);

      // 道具名称
      const nameElement = document.createElement("span");
      nameElement.className = "effect-name";
      nameElement.textContent = itemInfo.name;
      effectElement.appendChild(nameElement);

      whiteContent.appendChild(effectElement);
    });
  }

  /**
   * 绑定事件监听器
   */
  private bindEvents(): void {
    // 游戏模式选择
    document.getElementById("mode-pvp")?.addEventListener("click", () => {
      this.game.setConfig({ mode: GameMode.PVP });
      this.updateModeUI();
      this.game.restart();
      this.updateUI();
    });

    document.getElementById("mode-pve")?.addEventListener("click", () => {
      this.game.setConfig({ mode: GameMode.PVE });
      this.updateModeUI();
      this.updateColorUI(); // 切换到PVE模式时，更新颜色选择器的选中状态
      this.game.restart();
      this.updateUI();
    });

    // 玩家颜色选择
    document.getElementById("color-black")?.addEventListener("click", () => {
      this.game.setConfig({ playerColor: Player.BLACK });
      this.game.restart();
      this.updateColorUI();
      this.updateUI();
    });

    document.getElementById("color-white")?.addEventListener("click", () => {
      this.game.setConfig({ playerColor: Player.WHITE });
      this.game.restart();
      this.updateColorUI();
      this.updateUI();
    });

    // 悔棋按钮
    document.getElementById("undo-move")?.addEventListener("click", () => {
      this.game.undoMove();
      this.updateUI();
    });

    // 重新开始按钮
    document.getElementById("restart-game")?.addEventListener("click", () => {
      this.game.restart();
      this.updateUI();
    });

    // 15×15棋盘按钮
    document.getElementById("size-15")?.addEventListener("click", () => {
      this.game.setBoardSize(15);
      this.renderer.resizeBoard();
      this.updateUI();
    });

    // 19×19棋盘按钮
    document.getElementById("size-19")?.addEventListener("click", () => {
      this.game.setBoardSize(19);
      this.renderer.resizeBoard();
      this.updateUI();
    });
  }

  /**
   * 更新模式UI
   */
  private updateModeUI(): void {
    const config = this.game.getConfig();
    const colorSelector = document.getElementById("color-selector");

    // 获取模式选择按钮
    const pvpButton = document.getElementById("mode-pvp");
    const pveButton = document.getElementById("mode-pve");

    // 更新选中状态
    if (pvpButton && pveButton) {
      pvpButton.classList.toggle("selected", config.mode === GameMode.PVP);
      pveButton.classList.toggle("selected", config.mode === GameMode.PVE);
    }

    // 只有在PVE模式下显示颜色选择器
    if (colorSelector) {
      colorSelector.style.display = config.mode === GameMode.PVE ? "flex" : "none";
    }
  }

  /**
   * 更新颜色选择UI
   */
  private updateColorUI(): void {
    const config = this.game.getConfig();

    // 获取颜色选择按钮
    const blackButton = document.getElementById("color-black");
    const whiteButton = document.getElementById("color-white");

    // 更新选中状态
    if (blackButton && whiteButton) {
      blackButton.classList.toggle("selected", config.playerColor === Player.BLACK);
      whiteButton.classList.toggle("selected", config.playerColor === Player.WHITE);
    }
  }

  /**
   * 更新UI显示
   */
  public updateUI(): void {
    // 更新当前玩家显示
    this.updateCurrentPlayer();

    // 更新游戏状态显示
    this.updateGameState();

    // 更新状态栏
    this.updateStatusBar();

    // 更新道具开关状态
    this.updateItemToggleUI();
  }

  /**
   * 更新道具开关状态
   */
  private updateItemToggleUI(): void {
    if (this.itemToggle) {
      this.itemToggle.checked = this.game.getConfig().enableItems;
    }
  }

  /**
   * 更新当前玩家显示
   */
  private updateCurrentPlayer(): void {
    const currentPlayer = this.game.getCurrentPlayer();
    this.currentPlayerElement!.innerHTML = `
      <span>当前玩家: </span>
      <span class="player-indicator ${currentPlayer}">
        ${currentPlayer === Player.BLACK ? "黑方" : "白方"}
      </span>
    `;
  }

  /**
   * 更新游戏状态显示
   */
  private updateGameState(): void {
    const gameState = this.game.getGameState();
    const gameResult = this.game.getGameResult();

    let stateText = "";
    let stateClass = "";

    switch (gameState) {
      case GameState.READY:
        stateText = "准备就绪";
        stateClass = "ready";
        break;
      case GameState.PLAYING:
        stateText = "游戏进行中";
        stateClass = "playing";
        break;
      case GameState.PAUSED:
        stateText = "游戏暂停";
        stateClass = "paused";
        break;
      case GameState.OVER:
        if (gameResult?.winner) {
          stateText = `游戏结束，${gameResult.winner === Player.BLACK ? "黑方" : "白方"}获胜！`;
        } else {
          stateText = "游戏结束，平局！";
        }
        stateClass = "over";
        break;
    }

    this.gameStateElement!.innerHTML = `
      <span>游戏状态: </span>
      <span class="game-state-value ${stateClass}">${stateText}</span>
    `;
  }

}