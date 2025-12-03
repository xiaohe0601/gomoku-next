import type { Player, Position, StoneColor } from "./types";

export class Stone {

  private position: Position;
  private color: StoneColor;
  private radius: number;
  private isAnimating: boolean = false;
  private animationProgress: number = 0;

  /**
   * 构造函数
   * @param position 棋子位置
   * @param player 玩家
   * @param radius 棋子半径
   */
  constructor(position: Position, player: Player, radius: number = 15) {
    this.position = { ...position };
    this.color = player;
    this.radius = radius;
  }

  /**
   * 获取棋子位置
   */
  getPosition(): Position {
    return { ...this.position };
  }

  /**
   * 获取棋子颜色
   */
  getColor(): StoneColor {
    return this.color;
  }

  /**
   * 获取棋子半径
   */
  getRadius(): number {
    return this.radius;
  }

  /**
   * 设置棋子半径
   * @param radius 新的半径
   */
  setRadius(radius: number): void {
    this.radius = radius;
  }

  /**
   * 开始落子动画
   */
  startAnimation(): void {
    this.isAnimating = true;
    this.animationProgress = 0;
  }

  /**
   * 更新动画进度
   * @param deltaTime 时间增量（毫秒）
   * @returns 是否动画完成
   */
  updateAnimation(deltaTime: number): boolean {
    if (!this.isAnimating) {
      return true;
    }

    // 动画持续时间为300毫秒
    const animationDuration = 300;
    this.animationProgress += deltaTime;

    if (this.animationProgress >= animationDuration) {
      this.isAnimating = false;
      this.animationProgress = 1;
      return true;
    }

    return false;
  }

  /**
   * 获取当前动画缩放比例
   */
  getAnimationScale(): number {
    if (!this.isAnimating) {
      return 1;
    }

    // 使用缓动函数创建更自然的动画效果
    const t = this.animationProgress / 300;
    return 0.5 + 0.5 * Math.sin(t * Math.PI);
  }

  /**
   * 检查是否正在动画中
   */
  isAnimatingState(): boolean {
    return this.isAnimating;
  }

  /**
   * 检查点是否在棋子内
   * @param point 要检查的点
   */
  containsPoint(point: Position): boolean {
    const dx = point.x - this.position.x;
    const dy = point.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius;
  }

}