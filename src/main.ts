import { GomokuGame } from "./game/GomokuGame";
import { CanvasRenderer } from "./ui/CanvasRenderer";
import { GameUI } from "./ui/GameUI";
import "./styles.css";

// 初始化游戏
function initGame() {
  // 获取应用容器
  const appContainer = document.querySelector<HTMLDivElement>("#app")!;

  // 创建游戏容器
  const gameContainer = document.createElement("div");
  gameContainer.className = "gomoku-game";

  // 创建棋盘容器，用于包含游戏信息和Canvas
  const boardContainer = document.createElement("div");
  boardContainer.className = "board-container";
  gameContainer.appendChild(boardContainer);

  // 创建游戏信息区域，放在棋盘上方
  const gameInfoContainer = document.createElement("div");
  gameInfoContainer.id = "game-info-container";
  gameInfoContainer.className = "game-info-container";
  boardContainer.appendChild(gameInfoContainer);

  // 创建Canvas元素
  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  boardContainer.appendChild(canvas);

  // 创建UI容器
  const uiContainer = document.createElement("div");
  uiContainer.className = "game-ui";
  gameContainer.appendChild(uiContainer);

  // 添加到应用容器
  appContainer.appendChild(gameContainer);

  // 创建游戏实例
  const game = new GomokuGame(15);

  // 创建渲染器
  const renderer = new CanvasRenderer(canvas, game);

  // 创建UI控制器
  const gameUI = new GameUI(uiContainer, game, renderer, gameInfoContainer);

  // 将GameUI实例传递给CanvasRenderer
  renderer.setGameUI(gameUI);

  // 游戏UI初始更新
  gameUI.updateUI();

  // 开始新游戏
  game.startNewGame();
}

// 页面加载完成后初始化游戏
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}