import type { BoardSize, Move, Player, Position } from "./types";

export class Board {

  private size: BoardSize;
  private grid: (Player | null)[][];
  private moves: Move[] = [];

  /**
   * 构造函数
   * @param size 棋盘大小（15或19）
   */
  constructor(size: BoardSize = 15) {
    this.size = size;
    this.grid = this.initializeGrid();
  }

  /**
   * 初始化棋盘网格
   */
  private initializeGrid(): (Player | null)[][] {
    const grid: (Player | null)[][] = [];
    for (let y = 0; y < this.size; y++) {
      grid[y] = [];
      for (let x = 0; x < this.size; x++) {
        grid[y][x] = null;
      }
    }
    return grid;
  }

  /**
   * 获取棋盘大小
   */
  getSize(): BoardSize {
    return this.size;
  }

  /**
   * 检查位置是否在棋盘范围内
   * @param position 要检查的位置
   */
  isValidPosition(position: Position): boolean {
    return position.x >= 0 && position.x < this.size
      && position.y >= 0 && position.y < this.size;
  }

  /**
   * 检查位置是否为空
   * @param position 要检查的位置
   */
  isEmpty(position: Position): boolean {
    if (!this.isValidPosition(position)) {
      return false;
    }
    return this.grid[position.y][position.x] === null;
  }

  /**
   * 在指定位置落子
   * @param position 落子位置
   * @param player 玩家
   * @returns 是否落子成功
   */
  placeStone(position: Position, player: Player): boolean {
    if (!this.isEmpty(position)) {
      return false;
    }

    this.grid[position.y][position.x] = player;
    this.moves.push({
      position: { ...position },
      player,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * 获取指定位置的棋子
   * @param position 位置
   */
  getStone(position: Position): Player | null {
    if (!this.isValidPosition(position)) {
      return null;
    }
    return this.grid[position.y][position.x];
  }

  /**
   * 获取所有落子记录
   */
  getMoves(): Move[] {
    return [...this.moves];
  }

  /**
   * 悔棋
   * @returns 悔棋的落子记录，如果没有落子则返回null
   */
  undoMove(): Move | null {
    if (this.moves.length === 0) {
      return null;
    }

    const lastMove = this.moves.pop()!;
    this.grid[lastMove.position.y][lastMove.position.x] = null;
    return lastMove;
  }

  /**
   * 重置棋盘
   */
  reset(): void {
    this.grid = this.initializeGrid();
    this.moves = [];
  }

  /**
   * 获取棋盘网格数据（只读）
   */
  getGrid(): ReadonlyArray<ReadonlyArray<Player | null>> {
    return this.grid;
  }

  /**
   * 移除指定位置的棋子
   * @param position 要移除棋子的位置
   * @returns 是否移除成功
   */
  removeStone(position: Position): boolean {
    if (!this.isValidPosition(position)) {
      return false;
    }

    if (this.grid[position.y][position.x] === null) {
      return false;
    }

    this.grid[position.y][position.x] = null;
    return true;
  }

}