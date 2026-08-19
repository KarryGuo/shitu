/**
 * 车型库：品牌 → 车系 → 年款区间级联数据源。
 * 参考公开车型信息（汽车之家/懂车帝车型库风格）整理的演示数据集，
 * 覆盖国内主流在售品牌约 20 家；正式版可无缝切换为主数据服务 API（接口形状一致）。
 */

export type Fuel = '汽油' | '柴油' | '纯电' | '混动'

export interface CarModelEntry {
  /** 车系名 */
  name: string
  /** 年款区间 [起始年, 结束年]（结束年含当前年在售） */
  years: [number, number]
  /** 燃料类型建议（选中车系自动带出，可改） */
  fuel?: Fuel
}

export interface BrandEntry {
  brand: string
  models: CarModelEntry[]
}

const Y = new Date().getFullYear()

export const BRAND_MODELS: BrandEntry[] = [
  {
    brand: '大众',
    models: [
      { name: '朗逸', years: [2008, Y] },
      { name: '速腾', years: [2006, Y] },
      { name: '迈腾', years: [2007, Y] },
      { name: '帕萨特', years: [2000, Y] },
      { name: '途观L', years: [2017, Y] },
      { name: '探岳', years: [2018, Y] },
      { name: '高尔夫', years: [2003, Y] },
      { name: 'POLO', years: [2002, Y] },
      { name: 'ID.4 CROZZ', years: [2021, Y], fuel: '纯电' },
      { name: 'ID.3', years: [2021, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '丰田',
    models: [
      { name: '卡罗拉', years: [2004, Y] },
      { name: '雷凌', years: [2014, Y] },
      { name: '凯美瑞', years: [2001, Y] },
      { name: '亚洲龙', years: [2019, Y] },
      { name: 'RAV4荣放', years: [2009, Y] },
      { name: '威兰达', years: [2020, Y] },
      { name: '汉兰达', years: [2007, Y] },
      { name: '赛那SIENNA', years: [2021, Y] },
      { name: 'bZ3', years: [2023, Y], fuel: '纯电' },
      { name: '普拉多', years: [2003, Y] },
    ],
  },
  {
    brand: '本田',
    models: [
      { name: '思域', years: [2006, Y] },
      { name: '型格', years: [2021, Y] },
      { name: '雅阁', years: [1999, Y] },
      { name: '英仕派', years: [2018, Y] },
      { name: 'CR-V', years: [2004, Y] },
      { name: '皓影', years: [2019, Y] },
      { name: '缤智', years: [2014, Y] },
      { name: 'XR-V', years: [2014, Y] },
      { name: '奥德赛', years: [2002, Y] },
      { name: '艾力绅', years: [2012, Y] },
    ],
  },
  {
    brand: '比亚迪',
    models: [
      { name: '秦PLUS DM-i', years: [2021, Y], fuel: '混动' },
      { name: '秦PLUS EV', years: [2021, Y], fuel: '纯电' },
      { name: '汉DM', years: [2020, Y], fuel: '混动' },
      { name: '汉EV', years: [2020, Y], fuel: '纯电' },
      { name: '唐DM-i', years: [2018, Y], fuel: '混动' },
      { name: '宋PLUS DM-i', years: [2020, Y], fuel: '混动' },
      { name: '宋Pro DM-i', years: [2019, Y], fuel: '混动' },
      { name: '元PLUS', years: [2022, Y], fuel: '纯电' },
      { name: '海豚', years: [2021, Y], fuel: '纯电' },
      { name: '海豹', years: [2022, Y], fuel: '纯电' },
      { name: '驱逐舰05', years: [2022, Y], fuel: '混动' },
    ],
  },
  {
    brand: '特斯拉',
    models: [
      { name: 'Model 3', years: [2017, Y], fuel: '纯电' },
      { name: 'Model Y', years: [2021, Y], fuel: '纯电' },
      { name: 'Model S', years: [2014, Y], fuel: '纯电' },
      { name: 'Model X', years: [2016, Y], fuel: '纯电' },
      { name: 'Cybertruck', years: [2023, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '奥迪',
    models: [
      { name: 'A3', years: [2008, Y] },
      { name: 'A4L', years: [2009, Y] },
      { name: 'A6L', years: [2000, Y] },
      { name: 'Q3', years: [2013, Y] },
      { name: 'Q5L', years: [2018, Y] },
      { name: 'A7L', years: [2021, Y] },
      { name: 'Q7', years: [2006, Y] },
      { name: 'e-tron', years: [2021, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '宝马',
    models: [
      { name: '3系', years: [2003, Y] },
      { name: '5系', years: [2004, Y] },
      { name: '7系', years: [2002, Y] },
      { name: 'X1', years: [2010, Y] },
      { name: 'X3', years: [2004, Y] },
      { name: 'X5', years: [2000, Y] },
      { name: 'i3', years: [2021, Y], fuel: '纯电' },
      { name: 'iX3', years: [2021, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '奔驰',
    models: [
      { name: 'C级', years: [2005, Y] },
      { name: 'E级', years: [2005, Y] },
      { name: 'S级', years: [1991, Y] },
      { name: 'GLA', years: [2015, Y] },
      { name: 'GLC', years: [2015, Y] },
      { name: 'GLE', years: [2015, Y] },
      { name: 'EQC', years: [2019, Y], fuel: '纯电' },
      { name: 'EQS', years: [2021, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '吉利',
    models: [
      { name: '帝豪', years: [2009, Y] },
      { name: '星瑞', years: [2020, Y] },
      { name: '星越L', years: [2021, Y] },
      { name: '博越L', years: [2016, Y] },
      { name: '银河L6', years: [2023, Y], fuel: '混动' },
      { name: '银河L7', years: [2023, Y], fuel: '混动' },
      { name: '缤越', years: [2018, Y] },
      { name: '熊猫mini', years: [2022, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '长安',
    models: [
      { name: '逸动', years: [2012, Y] },
      { name: 'UNI-V', years: [2022, Y] },
      { name: 'UNI-K', years: [2021, Y] },
      { name: 'CS75 PLUS', years: [2014, Y] },
      { name: '深蓝SL03', years: [2022, Y], fuel: '纯电' },
      { name: '深蓝S7', years: [2023, Y], fuel: '纯电' },
      { name: '启源A07', years: [2023, Y], fuel: '混动' },
    ],
  },
  {
    brand: '五菱',
    models: [
      { name: '宏光MINIEV', years: [2020, Y], fuel: '纯电' },
      { name: '缤果', years: [2023, Y], fuel: '纯电' },
      { name: '星光', years: [2023, Y], fuel: '混动' },
      { name: '凯捷Victory', years: [2020, Y] },
      { name: '星辰', years: [2021, Y] },
    ],
  },
  {
    brand: '广汽埃安',
    models: [
      { name: 'AION S', years: [2019, Y], fuel: '纯电' },
      { name: 'AION Y', years: [2021, Y], fuel: '纯电' },
      { name: 'AION V', years: [2020, Y], fuel: '纯电' },
      { name: 'AION LX', years: [2019, Y], fuel: '纯电' },
      { name: '昊铂GT', years: [2023, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '蔚来',
    models: [
      { name: 'ES6', years: [2018, Y], fuel: '纯电' },
      { name: 'ES8', years: [2018, Y], fuel: '纯电' },
      { name: 'ET5', years: [2022, Y], fuel: '纯电' },
      { name: 'ET7', years: [2022, Y], fuel: '纯电' },
      { name: 'EC6', years: [2020, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '小鹏',
    models: [
      { name: 'P7', years: [2020, Y], fuel: '纯电' },
      { name: 'P5', years: [2021, Y], fuel: '纯电' },
      { name: 'G6', years: [2023, Y], fuel: '纯电' },
      { name: 'G9', years: [2022, Y], fuel: '纯电' },
      { name: 'X9', years: [2024, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '理想',
    models: [
      { name: 'L6', years: [2024, Y], fuel: '混动' },
      { name: 'L7', years: [2023, Y], fuel: '混动' },
      { name: 'L8', years: [2022, Y], fuel: '混动' },
      { name: 'L9', years: [2022, Y], fuel: '混动' },
      { name: 'MEGA', years: [2024, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '问界',
    models: [
      { name: 'M5', years: [2022, Y], fuel: '混动' },
      { name: 'M7', years: [2022, Y], fuel: '混动' },
      { name: 'M9', years: [2023, Y], fuel: '混动' },
    ],
  },
  {
    brand: '极氪',
    models: [
      { name: '001', years: [2021, Y], fuel: '纯电' },
      { name: '007', years: [2023, Y], fuel: '纯电' },
      { name: '009', years: [2022, Y], fuel: '纯电' },
      { name: 'X', years: [2023, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '日产',
    models: [
      { name: '轩逸', years: [2006, Y] },
      { name: '天籁', years: [2004, Y] },
      { name: '骐达', years: [2005, Y] },
      { name: '奇骏', years: [2002, Y] },
      { name: '逍客', years: [2008, Y] },
      { name: '楼兰', years: [2011, Y] },
      { name: '艾睿雅', years: [2022, Y], fuel: '纯电' },
    ],
  },
  {
    brand: '哈弗',
    models: [
      { name: 'H6', years: [2011, Y] },
      { name: '大狗', years: [2020, Y] },
      { name: '猛龙', years: [2023, Y], fuel: '混动' },
      { name: '枭龙MAX', years: [2023, Y], fuel: '混动' },
      { name: 'H9', years: [2015, Y] },
    ],
  },
  {
    brand: '奇瑞',
    models: [
      { name: '瑞虎8', years: [2018, Y] },
      { name: '瑞虎7', years: [2016, Y] },
      { name: '艾瑞泽8', years: [2022, Y] },
      { name: '小蚂蚁', years: [2017, Y], fuel: '纯电' },
      { name: '风云A8', years: [2023, Y], fuel: '混动' },
    ],
  },
  {
    brand: '红旗',
    models: [
      { name: 'H5', years: [2018, Y] },
      { name: 'HS5', years: [2019, Y] },
      { name: 'H9', years: [2020, Y] },
      { name: 'E-QM5', years: [2021, Y], fuel: '纯电' },
      { name: 'EH7', years: [2024, Y], fuel: '纯电' },
    ],
  },
]

export const BRANDS = BRAND_MODELS.map((b) => b.brand)

/** 品牌下的车系列表（未知品牌返回空） */
export const getModels = (brand: string): CarModelEntry[] =>
  BRAND_MODELS.find((b) => b.brand === brand)?.models ?? []

/** 车系年款区间（未知返回通用区间） */
export const getModelYears = (brand: string, model: string): [number, number] =>
  getModels(brand).find((m) => m.name === model)?.years ?? [2000, Y]

/** 车系年款下拉序列（新→旧） */
export const yearOptions = (brand: string, model: string): number[] => {
  const [start, end] = getModelYears(brand, model)
  const list: number[] = []
  for (let y = Math.min(end, Y); y >= start; y--) list.push(y)
  return list
}

/** 车系燃料类型建议（选中车系自动带出） */
export const fuelOf = (brand: string, model: string): Fuel | undefined =>
  getModels(brand).find((m) => m.name === model)?.fuel
