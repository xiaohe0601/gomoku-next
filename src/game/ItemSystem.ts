import { ItemEffectType, ItemType } from "./types";
import type { BlindBox, ItemInfo, Position } from "./types";

// 道具信息映射
export const ITEM_INFO_MAP: Record<ItemType, ItemInfo> = {
  // 强化类道具
  [ItemType.CHAOS_STRIKE]: {
    type: ItemType.CHAOS_STRIKE,
    name: "混沌打击",
    description: "随机移除对手的1颗棋子",
    effect: {
      type: ItemEffectType.INSTANT,
      description: "随机移除对手的1颗棋子"
    },
    isStrengthening: true,
    icon: "⚡"
  },
  [ItemType.PRECISE_STRIKE]: {
    type: ItemType.PRECISE_STRIKE,
    name: "精准打击",
    description: "允许玩家指定移除对手的1颗棋子",
    effect: {
      type: ItemEffectType.DELAYED,
      description: "允许玩家指定移除对手的1颗棋子"
    },
    isStrengthening: true,
    icon: "🎯"
  },
  [ItemType.ACCELERATED_MOVE]: {
    type: ItemType.ACCELERATED_MOVE,
    name: "加速落子",
    description: "使玩家在本回合获得额外1次落子机会",
    effect: {
      type: ItemEffectType.INSTANT,
      description: "获得额外1次落子机会"
    },
    isStrengthening: true,
    icon: "🚀"
  },
  [ItemType.STRATEGY_GUIDE]: {
    type: ItemType.STRATEGY_GUIDE,
    name: "策略指引",
    description: "额外获得1次落子机会，并且系统将推荐3个最优落子位置",
    effect: {
      type: ItemEffectType.DELAYED,
      description: "获得额外落子机会并显示3个最优落子位置"
    },
    isStrengthening: true,
    icon: "🧠"
  },
  [ItemType.TOUGHEN_HEART]: {
    type: ItemType.TOUGHEN_HEART,
    name: "钢化我心",
    description: "使玩家免疫下一次对手发起的移除类攻击",
    effect: {
      type: ItemEffectType.CONTINUOUS,
      duration: 1,
      description: "免疫下一次移除类攻击"
    },
    isStrengthening: true,
    icon: "🛡️"
  },

  // 弱化类道具
  [ItemType.SELF_MISTAKE]: {
    type: ItemType.SELF_MISTAKE,
    name: "自我失误",
    description: "随机移除玩家自己的1颗棋子",
    effect: {
      type: ItemEffectType.INSTANT,
      description: "随机移除自己的1颗棋子"
    },
    isStrengthening: false,
    icon: "💥"
  },
  [ItemType.OPPONENT_ACCELERATION]: {
    type: ItemType.OPPONENT_ACCELERATION,
    name: "对手加速",
    description: "使对手在本回合获得额外1次落子机会",
    effect: {
      type: ItemEffectType.INSTANT,
      description: "对手获得额外1次落子机会"
    },
    isStrengthening: false,
    icon: "⚡"
  },
  [ItemType.SLIP_PENALTY]: {
    type: ItemType.SLIP_PENALTY,
    name: "手滑惩罚",
    description: "限制对手下一回合只能从系统随机给出的3个位置中选择1个落子",
    effect: {
      type: ItemEffectType.CONTINUOUS,
      duration: 1,
      description: "对手只能从3个随机位置中选择落子"
    },
    isStrengthening: true,
    icon: "🤦"
  }
};

export class ItemSystem {

  private availableItems: ItemType[];
  private strengtheningItems: ItemType[];
  private weakeningItems: ItemType[];

  constructor() {
    // 初始化道具列表
    this.availableItems = Object.values(ItemType);
    this.strengtheningItems = this.availableItems.filter((type) => ITEM_INFO_MAP[type].isStrengthening);
    this.weakeningItems = this.availableItems.filter((type) => !ITEM_INFO_MAP[type].isStrengthening);
  }

  /**
   * 获取道具信息
   * @param type 道具类型
   */
  getItemInfo(type: ItemType): ItemInfo {
    return ITEM_INFO_MAP[type];
  }

  /**
   * 随机生成一个道具类型
   * @param strengtheningBias 强化类道具的概率权重（0-1）
   */
  generateRandomItemType(strengtheningBias: number = 0.5): ItemType {
    const rand = Math.random();
    const itemsPool = rand < strengtheningBias ? this.strengtheningItems : this.weakeningItems;
    const randomIndex = Math.floor(Math.random() * itemsPool.length);
    return itemsPool[randomIndex];
  }

  /**
   * 生成盲盒
   * @param availablePositions 可用位置列表
   * @param strengtheningBias 强化类道具的概率权重
   */
  generateBlindBox(availablePositions: Position[], strengtheningBias: number = 0.5): BlindBox | null {
    if (availablePositions.length === 0) {
      return null;
    }

    // 随机选择一个位置
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    const position = availablePositions[randomIndex];

    // 随机生成一个道具
    const itemType = this.generateRandomItemType(strengtheningBias);

    // 创建盲盒
    return {
      position,
      itemType,
      isOpened: false,
      timestamp: Date.now()
    };
  }

  /**
   * 获取所有可用位置
   * @param boardSize 棋盘大小
   * @param isPositionEmpty 检查位置是否为空的回调函数
   */
  getAvailablePositions(boardSize: number, isPositionEmpty: (pos: Position) => boolean): Position[] {
    const availablePositions: Position[] = [];

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const pos = { x, y };
        if (isPositionEmpty(pos)) {
          availablePositions.push(pos);
        }
      }
    }

    return availablePositions;
  }

  /**
   * 检查位置是否有盲盒
   * @param position 要检查的位置
   * @param blindBoxes 当前棋盘上的盲盒列表
   */
  findBlindBoxAtPosition(position: Position, blindBoxes: BlindBox[]): BlindBox | undefined {
    return blindBoxes.find((box) => !box.isOpened
      && box.position.x === position.x
      && box.position.y === position.y);
  }

}