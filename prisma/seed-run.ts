/**
 * 独立种子脚本 — 不依赖 Next.js 服务器
 * 运行: cd /home/z/my-project && npx tsx prisma/seed-run.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ── 复制种子逻辑 ──
// 数值参数: [参数名, 参数编码, 单位, 标准下限, 标准上限, 最优下限, 最优上限]
type NumP = [string, string, string, number, number, number, number]
type OptP = [string, string, string[]]

const CATEGORY_PARAMS: Record<string, { num: NumP[]; opt: OptP[] }> = {
  ZT: {
    num: [
      ['外径D', 'OD_D', 'mm', 47.5, 48.5, 47.8, 48.2],
      ['内径d', 'ID_d', 'mm', 18.0, 19.0, 18.3, 18.7],
      ['总长度L', 'LEN_L', 'mm', 280, 285, 281, 283],
      ['头部长度L1', 'LEN_L1', 'mm', 85, 90, 86, 89],
      ['螺纹长度L2', 'LEN_L2', 'mm', 50, 55, 51, 54],
      ['合金齿高度h', 'TOOTH_H', 'mm', 5.0, 6.0, 5.3, 5.7],
      ['齿间距p', 'TOOTH_P', 'mm', 12.0, 13.0, 12.3, 12.7],
      ['排粉槽深度', 'GROOVE_D', 'mm', 3.0, 4.0, 3.3, 3.7],
      ['排粉槽宽度', 'GROOVE_W', 'mm', 6.0, 7.0, 6.3, 6.7],
      ['冲击端面角度', 'FACE_ANG', '°', 108, 112, 109, 111],
      ['螺纹中径', 'THREAD_PD', 'mm', 21.5, 22.0, 21.7, 21.9],
      ['螺纹螺距', 'THREAD_P', 'mm', 2.28, 2.32, 2.29, 2.31],
      ['重量', 'WT', 'g', 1850, 1950, 1880, 1920],
      ['硬度HRC-齿部', 'HRC_TOOTH', 'HRC', 38, 45, 40, 43],
      ['硬度HRC-体部', 'HRC_BODY', 'HRC', 35, 42, 37, 40],
      ['粗糙度Ra-外圆', 'RA_OD', 'μm', 0, 3.2, 0, 1.6],
      ['粗糙度Ra-内孔', 'RA_ID', 'μm', 0, 3.2, 0, 1.6],
      ['粗糙度Ra-端面', 'RA_FACE', 'μm', 0, 3.2, 0, 1.6],
      ['圆度', 'ROUND', 'mm', 0, 0.04, 0, 0.02],
      ['圆柱度', 'CYLIN', 'mm', 0, 0.05, 0, 0.025],
      ['直线度', 'STRAIGHT', 'mm/m', 0, 0.08, 0, 0.04],
      ['同轴度', 'CONCEN', 'mm', 0, 0.06, 0, 0.03],
      ['径向跳动', 'RUNOUT_R', 'mm', 0, 0.04, 0, 0.02],
      ['端面跳动', 'RUNOUT_T', 'mm', 0, 0.05, 0, 0.03],
      ['碳化钨含量', 'WC_PCT', '%', 85, 92, 87, 91],
      ['钴含量', 'CO_PCT', '%', 8, 12, 9, 11],
      ['抗弯强度', 'BEND_STR', 'MPa', 1800, 2500, 2000, 2400],
      ['冲击韧性', 'IMPACT', 'J/cm²', 3.0, 6.0, 4.0, 5.5],
      ['脱碳层深度', 'DECARB', 'mm', 0, 0.15, 0, 0.08],
      ['耐磨层厚度', 'WEAR_THK', 'mm', 0.8, 1.5, 1.0, 1.3],
      ['尺寸稳定性', 'DIM_STAB', 'mm', 0, 0.02, 0, 0.01],
      ['装配间隙', 'FIT_GAP', 'mm', 0.02, 0.10, 0.04, 0.08],
    ],
    opt: [
      ['焊缝质量', 'WELD_Q', ['良好', '一般', '不合格']]
      ['金相组织', 'METAL', ['均匀细小', '正常', '粗大', '不合格']],
      ['外观检查', 'VISUAL', ['合格', '不合格']],
      ['磁粉探伤', 'MT', ['无缺陷', '合格', '不合格']],
      ['超声波探伤', 'UT', ['无缺陷', '合格', '不合格']],
      ['螺纹规格检查', 'THREAD_CHK', ['符合', '不符合']],
      ['综合判定', 'VERDICT', ['合格', '不合格', '待复检']],
      ['耐磨试验', 'WEAR_TST', ['达标', '未达标']],
    ],
  },
  HS: {
    num: [
      ['外径D', 'OD_D', 'mm', 119.5, 120.5, 119.8, 120.2],
      ['内径d', 'ID_d', 'mm', 58.0, 60.0, 58.5, 59.5],
      ['总长度L', 'LEN_L', 'mm', 278, 282, 279, 281],
      ['活塞杆直径D1', 'ROD_D1', 'mm', 59.5, 60.5, 59.8, 60.2],
      ['活塞头直径D2', 'HEAD_D2', 'mm', 119.0, 120.0, 119.3, 119.7],
      ['活塞头厚度H1', 'HEAD_H1', 'mm', 48, 52, 49, 51],
      ['活塞杆长度H2', 'ROD_H2', 'mm', 225, 235, 228, 232],
      ['密封槽宽度b', 'SEAL_W', 'mm', 4.0, 4.5, 4.1, 4.4],
      ['密封槽深度t', 'SEAL_D', 'mm', 2.5, 3.0, 2.6, 2.9],
      ['密封槽数量', 'SEAL_N', '个', 3, 5, 3, 5],
      ['重量', 'WT', 'kg', 8.5, 9.5, 8.8, 9.2],
      ['硬度HRC-表面', 'HRC_SURF', 'HRC', 58, 64, 60, 63],
      ['硬度HRC-芯部', 'HRC_CORE', 'HRC', 30, 38, 32, 36],
      ['渗碳层深度', 'CARB_DP', 'mm', 0.8, 1.5, 1.0, 1.3],
      ['粗糙度Ra-外圆', 'RA_OD', 'μm', 0, 0.8, 0, 0.4],
      ['粗糙度Ra-内孔', 'RA_ID', 'μm', 0, 1.6, 0, 0.8],
      ['粗糙度Ra-杆部', 'RA_ROD', 'μm', 0, 0.4, 0, 0.2],
      ['圆柱度', 'CYLIN', 'mm', 0, 0.03, 0, 0.015],
      ['圆度', 'ROUND', 'mm', 0, 0.02, 0, 0.01],
      ['直线度', 'STRAIGHT', 'mm/m', 0, 0.04, 0, 0.02],
      ['同轴度', 'CONCEN', 'mm', 0, 0.03, 0, 0.015],
      ['径向跳动', 'RUNOUT_R', 'mm', 0, 0.025, 0, 0.012],
      ['端面跳动', 'RUNOUT_T', 'mm', 0, 0.02, 0, 0.01],
      ['密封面平面度', 'SEAL_FLAT', 'mm', 0, 0.02, 0, 0.01],
      ['密封面粗糙度', 'RA_SEAL', 'μm', 0, 0.8, 0, 0.4],
      ['螺纹中径', 'THREAD_PD', 'mm', 59.0, 60.0, 59.3, 59.7],
      ['抗拉强度', 'TENSILE', 'MPa', 1100, 1400, 1200, 1350],
      ['屈服强度', 'YIELD', 'MPa', 850, 1100, 900, 1050],
      ['延伸率', 'ELONG', '%', 10, 16, 12, 15],
      ['冲击韧性', 'IMPACT', 'J/cm²', 60, 100, 70, 95],
      ['疲劳寿命', 'FATIGUE', '万次', 50, 120, 80, 110],
      ['尺寸稳定性', 'DIM_STAB', 'mm', 0, 0.015, 0, 0.008],
      ['表面残余应力', 'RESIDUAL', 'MPa', 0, 50, 0, 30],
    ],
    opt: [
      ['螺纹规格检查', 'THREAD_CHK', ['符合', '不符合']]
      ['磁粉探伤', 'MT', ['无缺陷', '合格', '不合格']],
      ['超声波探伤', 'UT', ['无缺陷', '合格', '不合格']],
      ['金相组织', 'METAL', ['均匀细小', '正常', '粗大']],
      ['外观检查', 'VISUAL', ['合格', '不合格']],
      ['装配检验', 'ASSY_CHK', ['合格', '不合格']],
      ['耐磨试验', 'WEAR_TST', ['合格', '不合格']],
      ['综合判定', 'VERDICT', ['合格', '不合格', '待复检']],
    ],
  },
  QG: {
    num: [
      ['缸体内径D', 'CYL_ID', 'mm', 119.8, 120.2, 119.9, 120.1],
      ['缸体外径D1', 'CYL_OD', 'mm', 149.0, 151.0, 149.5, 150.5],
      ['总长度L', 'LEN_L', 'mm', 398, 402, 399, 401],
      ['缸盖厚度H1', 'HEAD_H1', 'mm', 38, 42, 39, 41],
      ['法兰外径D2', 'FLG_OD', 'mm', 179.0, 181.0, 179.5, 180.5],
      ['法兰厚度H2', 'FLG_H2', 'mm', 18, 22, 19, 21],
      ['螺栓孔分布圆D3', 'BOLT_PCD', 'mm', 168, 172, 169, 171],
      ['螺栓孔直径d', 'BOLT_D', 'mm', 12.5, 13.5, 12.8, 13.2],
      ['配气孔直径d1', 'GAS_D', 'mm', 8.0, 9.0, 8.3, 8.7],
      ['配气孔位置度', 'GAS_POS', 'mm', 0, 0.15, 0, 0.08],
      ['进气口直径d2', 'IN_D', 'mm', 24.5, 25.5, 24.8, 25.2],
      ['排气口直径d3', 'OUT_D', 'mm', 19.5, 20.5, 19.8, 20.2],
      ['重量', 'WT', 'kg', 32, 36, 33, 35],
      ['硬度HRC-内壁', 'HRC_IN', 'HRC', 45, 55, 48, 52],
      ['硬度HRC-外壁', 'HRC_OUT', 'HRC', 22, 30, 24, 28],
      ['渗氮层深度', 'NITR_DP', 'mm', 0.3, 0.6, 0.35, 0.55],
      ['粗糙度Ra-内壁', 'RA_IN', 'μm', 0, 0.8, 0, 0.4],
      ['粗糙度Ra-外壁', 'RA_OUT', 'μm', 0, 3.2, 0, 1.6],
      ['圆柱度', 'CYLIN', 'mm', 0, 0.025, 0, 0.012],
      ['圆度', 'ROUND', 'mm', 0, 0.015, 0, 0.008],
      ['直线度', 'STRAIGHT', 'mm/m', 0, 0.05, 0, 0.025],
      ['同轴度', 'CONCEN', 'mm', 0, 0.04, 0, 0.02],
      ['内壁径向跳动', 'RUNOUT_IN', 'mm', 0, 0.02, 0, 0.01],
      ['法兰端面跳动', 'RUNOUT_FLG', 'mm', 0, 0.03, 0, 0.015],
      ['法兰端面平面度', 'FLG_FLAT', 'mm', 0, 0.02, 0, 0.01],
      ['水压试验', 'HYDRO', 'MPa', 1.2, 1.5, 1.25, 1.45],
      ['抗拉强度', 'TENSILE', 'MPa', 500, 650, 530, 620],
      ['延伸率', 'ELONG', '%', 18, 28, 20, 26],
      ['螺栓孔数量', 'BOLT_N', '个', 6, 8, 6, 8],
      ['装配尺寸偏差', 'ASSY_DIM', 'mm', 0, 0.05, 0, 0.025],
      ['尺寸链误差', 'DIM_CHAIN', 'mm', 0, 0.03, 0, 0.015],
    ],
    opt: [
      ['螺纹孔精度', 'THREAD_ACC', ['6H', '6G', '不合格']],
      ['磁粉探伤', 'MT', ['无缺陷', '合格', '不合格']],
      ['超声波探伤', 'UT', ['无缺陷', '合格', '不合格']],
      ['气密性试验', 'AIR_TST', ['无泄漏', '微漏', '泄漏']],
      ['金相组织', 'METAL', ['均匀细小', '正常', '粗大']],
      ['表面处理质量', 'SURF_TRT', ['合格', '不合格']],
      ['外观检查', 'VISUAL', ['合格', '不合格']],
      ['寿命试验', 'LIFE_TST', ['达标', '未达标']],
      ['综合判定', 'VERDICT', ['合格', '不合格', '待复检']],
    ],
  },
  FZ: {
    num: [
      ['阀体外径D', 'VALVE_OD', 'mm', 59.5, 60.5, 59.8, 60.2],
      ['阀体内径d', 'VALVE_ID', 'mm', 28.0, 29.0, 28.3, 28.7],
      ['阀芯直径D1', 'CORE_D', 'mm', 27.5, 28.5, 27.8, 28.2],
      ['阀体长度L', 'VALVE_L', 'mm', 78, 82, 79, 81],
      ['阀芯长度L1', 'CORE_L', 'mm', 58, 62, 59, 61],
      ['阀口直径d1', 'PORT_D', 'mm', 8.0, 9.0, 8.3, 8.7],
      ['密封面宽度b', 'SEAL_W', 'mm', 1.5, 2.5, 1.8, 2.2],
      ['弹簧自由高度H', 'SPR_H', 'mm', 24, 28, 25, 27],
      ['弹簧刚度K', 'SPR_K', 'N/mm', 2.5, 3.5, 2.8, 3.2],
      ['弹簧预压缩量', 'SPR_PRE', 'mm', 4, 8, 5, 7],
      ['重量', 'WT', 'g', 380, 420, 390, 410],
      ['硬度HRC-阀芯', 'HRC_CORE', 'HRC', 58, 64, 60, 63],
      ['硬度HRC-阀体', 'HRC_BODY', 'HRC', 28, 35, 30, 33],
      ['粗糙度Ra-密封面', 'RA_SEAL', 'μm', 0, 0.4, 0, 0.2],
      ['粗糙度Ra-阀芯', 'RA_CORE', 'μm', 0, 0.8, 0, 0.4],
      ['粗糙度Ra-阀体', 'RA_BODY', 'μm', 0, 1.6, 0, 0.8],
      ['圆柱度-阀芯', 'CYLIN_CORE', 'mm', 0, 0.01, 0, 0.005],
      ['圆柱度-阀体', 'CYLIN_BODY', 'mm', 0, 0.02, 0, 0.01],
      ['圆度-阀芯', 'ROUND_CORE', 'mm', 0, 0.008, 0, 0.004],
      ['圆度-阀体', 'ROUND_BODY', 'mm', 0, 0.015, 0, 0.008],
      ['同轴度', 'CONCEN', 'mm', 0, 0.02, 0, 0.01],
      ['密封面平面度', 'SEAL_FLAT', 'mm', 0, 0.01, 0, 0.005],
      ['阀芯直线度', 'CORE_STR', 'mm', 0, 0.015, 0, 0.008],
      ['配合间隙', 'FIT_GAP', 'mm', 0.02, 0.08, 0.03, 0.06],
      ['抗拉强度', 'TENSILE', 'MPa', 900, 1200, 1000, 1150],
      ['屈服强度', 'YIELD', 'MPa', 700, 950, 750, 900],
      ['延伸率', 'ELONG', '%', 12, 20, 14, 18],
      ['冲击韧性', 'IMPACT', 'J/cm²', 50, 80, 60, 75],
      ['疲劳寿命', 'FATIGUE', '万次', 30, 80, 50, 70],
      ['尺寸稳定性', 'DIM_STAB', 'mm', 0, 0.01, 0, 0.005],
      ['清洁度', 'CLEAN', 'mg', 0, 5, 0, 2],
    ],
    opt: [
      ['磁粉探伤', 'MT', ['无缺陷', '合格', '不合格']],
      ['超声波探伤', 'UT', ['无缺陷', '合格', '不合格']],
      ['金相组织', 'METAL', ['均匀细小', '正常', '粗大']],
      ['弹簧疲劳试验', 'SPR_FAT', ['合格', '不合格']],
      ['密封性试验', 'SEAL_TST', ['无泄漏', '合格', '不合格']],
      ['动作灵活性', 'ACTION', ['灵活', '卡滞', '不合格']],
      ['外观检查', 'VISUAL', ['合格', '不合格']],
      ['装配检验', 'ASSY_CHK', ['合格', '不合格']],
      ['综合判定', 'VERDICT', ['合格', '不合格', '待复检']],
    ],
  },
  ZC: {
    num: [
      ['内径d', 'ID_d', 'mm', 59.95, 60.05, 59.98, 60.02],
      ['外径D', 'OD_D', 'mm', 89.9, 90.1, 89.95, 90.05],
      ['宽度B', 'WD_B', 'mm', 21.9, 22.1, 21.95, 22.05],
      ['内圈宽度B1', 'IR_B', 'mm', 21.9, 22.1, 21.95, 22.05],
      ['外圈宽度B2', 'OR_B', 'mm', 21.9, 22.1, 21.95, 22.05],
      ['滚子直径', 'ROLLER_D', 'mm', 8.9, 9.1, 8.95, 9.05],
      ['滚子长度', 'ROLLER_L', 'mm', 12.9, 13.1, 12.95, 13.05],
      ['滚子数量', 'ROLLER_N', '个', 9, 11, 10, 10],
      ['保持架宽度', 'CAGE_W', 'mm', 3.5, 4.5, 3.8, 4.2],
      ['保持架外径', 'CAGE_OD', 'mm', 74, 76, 74.5, 75.5],
      ['重量', 'WT', 'g', 380, 420, 390, 410],
      ['硬度HRC-内圈', 'HRC_IR', 'HRC', 60, 65, 61, 64],
      ['硬度HRC-外圈', 'HRC_OR', 'HRC', 58, 63, 59, 62],
      ['硬度HRC-滚子', 'HRC_ROLLER', 'HRC', 62, 66, 63, 65],
      ['粗糙度Ra-内径', 'RA_ID', 'μm', 0, 0.4, 0, 0.2],
      ['粗糙度Ra-外径', 'RA_OD', 'μm', 0, 0.4, 0, 0.2],
      ['粗糙度Ra-端面', 'RA_FACE', 'μm', 0, 0.8, 0, 0.4],
      ['内圈圆柱度', 'CYLIN_IR', 'mm', 0, 0.008, 0, 0.004],
      ['外圈圆柱度', 'CYLIN_OR', 'mm', 0, 0.01, 0, 0.005],
      ['内圈圆度', 'ROUND_IR', 'mm', 0, 0.006, 0, 0.003],
      ['外圈圆度', 'ROUND_OR', 'mm', 0, 0.008, 0, 0.004],
      ['内圈径向跳动', 'RUNOUT_IR', 'mm', 0, 0.01, 0, 0.005],
      ['外圈径向跳动', 'RUNOUT_OR', 'mm', 0, 0.015, 0, 0.008],
      ['轴向游隙', 'AXIAL_CLR', 'mm', 0.05, 0.15, 0.08, 0.12],
      ['径向游隙', 'RAD_CLR', 'mm', 0.02, 0.06, 0.03, 0.05],
      ['滚子圆度', 'ROUND_ROLLER', 'mm', 0, 0.003, 0, 0.0015],
      ['滚子直径差', 'ROLLER_DIFF', 'mm', 0, 0.005, 0, 0.002],
      ['抗拉强度', 'TENSILE', 'MPa', 1800, 2200, 1900, 2100],
      ['冲击韧性', 'IMPACT', 'J/cm²', 20, 40, 25, 35],
      ['疲劳寿命', 'FATIGUE', '万次', 100, 300, 150, 280],
      ['温升试验', 'TEMP_RISE', '°C', 0, 35, 0, 25],
    ],
    opt: [
      ['磁粉探伤', 'MT', ['无缺陷', '合格', '不合格']],
      ['超声波探伤', 'UT', ['无缺陷', '合格', '不合格']],
      ['金相组织', 'METAL', ['均匀细小', '正常', '粗大']],
      ['振动测试', 'VIB_TST', ['合格', '不合格']],
      ['外观检查', 'VISUAL', ['合格', '不合格']],
      ['装配检验', 'ASSY_CHK', ['合格', '不合格']],
      ['防锈处理', 'RUST_TRT', ['合格', '不合格']],
      ['清洁度', 'CLEAN', ['合格', '不合格']],
      ['综合判定', 'VERDICT', ['合格', '不合格', '待复检']],
    ],
  },
  MF: {
    num: [
      ['内径d', 'ID_d', 'mm', 59.5, 60.5, 59.7, 60.3],
      ['外径D', 'OD_D', 'mm', 79.0, 81.0, 79.3, 80.7],
      ['截面直径W', 'SEC_W', 'mm', 9.5, 10.5, 9.7, 10.3],
      ['自由内径', 'FREE_ID', 'mm', 55, 58, 56, 57],
      ['自由外径', 'FREE_OD', 'mm', 85, 90, 86, 89],
      ['截面高度H', 'SEC_H', 'mm', 9.5, 10.5, 9.8, 10.2],
      ['唇口厚度', 'LIP_THK', 'mm', 0.8, 1.5, 1.0, 1.3],
      ['唇口角度', 'LIP_ANG', '°', 20, 30, 22, 28],
      ['背部厚度', 'BACK_THK', 'mm', 2.0, 3.0, 2.3, 2.7],
      ['弹簧槽直径', 'SPR_GROOVE', 'mm', 1.0, 1.5, 1.1, 1.4],
      ['弹簧直径', 'SPR_D', 'mm', 0.8, 1.2, 0.9, 1.1],
      ['重量', 'WT', 'g', 28, 35, 30, 33],
      ['硬度IRHD', 'IRHD', 'IRHD', 70, 90, 75, 85],
      ['硬度-唇部', 'IRHD_LIP', 'IRHD', 75, 92, 78, 88],
      ['硬度-体部', 'IRHD_BODY', 'IRHD', 65, 85, 70, 80],
      ['拉伸强度', 'TENSILE', 'MPa', 10, 25, 15, 22],
      ['扯断伸长率', 'ELONG', '%', 200, 500, 300, 450],
      ['压缩永久变形', 'COMP_DEF', '%', 0, 30, 0, 20],
      ['热空气老化', 'AGING_TEMP', '°C', 100, 120, 105, 115],
      ['压缩变形量', 'COMP_AMT', '%', 5, 25, 8, 18],
      ['回弹率', 'REBOUND', '%', 40, 80, 55, 75],
      ['摩擦系数', 'FRICTION', '', 0.2, 0.6, 0.3, 0.5],
      ['耐压试验', 'PRES_TST', 'MPa', 1.0, 1.5, 1.1, 1.4],
      ['泄漏量', 'LEAKAGE', 'ml/h', 0, 5, 0, 2],
      ['尺寸稳定性', 'DIM_STAB', '%', 0, 5, 0, 3],
      ['低温脆性', 'COLD_BRIT', '°C', -40, -20, -38, -22],
      ['高温压缩', 'HT_COMP', '°C', 100, 130, 105, 125],
      ['密度', 'DENSITY', 'g/cm³', 1.1, 1.3, 1.15, 1.25],
      ['结合强度', 'BOND_STR', 'N/cm', 15, 30, 20, 28],
      ['表面粗糙度', 'RA_SURF', 'μm', 0, 3.2, 0, 1.6],
      ['同心度', 'CONCEN', 'mm', 0, 0.15, 0, 0.08],
      ['老化后硬度变化', 'AGING_HD', 'IRHD', -8, 8, -5, 5],
    ],
    opt: [
      ['唇口完整性', 'LIP_INT', ['完整', '缺陷', '不合格']]
      ['耐介质试验', 'MEDIA_TST', ['无异常', '合格', '不合格']],
      ['弹簧匹配性', 'SPR_FIT', ['匹配', '不匹配']],
      ['批次一致性', 'BATCH_CST', ['一致', '不一致']],
      ['外观全检', 'FULL_VIS', ['合格', '不合格']],
      ['包装检查', 'PKG_CHK', ['合格', '不合格']],
      ['外观检查', 'VISUAL', ['合格', '不合格']],
      ['综合判定', 'VERDICT', ['合格', '不合格', '待复检']],
      ['装配检验', 'ASSY_CHK', ['合格', '不合格']],
    ],
  },
}

// 验证每类 40 项
for (const [code, { num, opt }] of Object.entries(CATEGORY_PARAMS)) {
  if (num.length + opt.length !== 40) throw new Error(`类别 ${code} 参数总数 ${num.length + opt.length} ≠ 40`)
}

function genNumValue(smin: number, smax: number, omin: number, omax: number) {
  const range = smax - smin
  const value = Math.random() < 0.85
    ? smin + Math.random() * range
    : (Math.random() < 0.5 ? smin - Math.random() * range * 0.1 : smax + Math.random() * range * 0.1)
  return {
    value: Math.round(value * 10000) / 10000,
    is_qualified: value >= smin && value <= smax,
    is_optimal: value >= omin && value <= omax,
  }
}

function genOptValue(options: string[]) {
  const text = Math.random() < 0.9 ? options[0] : options[Math.floor(Math.random() * options.length)]
  const is_qualified = text === options[0]
  return { text, is_qualified, is_optimal: is_qualified }
}

// ============================================================

async function main() {
  const t0 = Date.now()

  // 1. 幂等清空
  await db.meeting_resolution.deleteMany()
  await db.attendance_record.deleteMany()
  await db.document.deleteMany()
  await db.meeting.deleteMany()
  await db.task.deleteMany()
  await db.analysis_report.deleteMany()
  await db.inspection_data_item.deleteMany()
  await db.inspection_record.deleteMany()
  await db.parameter_item.deleteMany()
  await db.parameter_template.deleteMany()
  await db.part.deleteMany()
  await db.equipment.deleteMany()
  await db.part_category.deleteMany()

  // 2. 零件类别
  const categories = await Promise.all([
    db.part_category.create({ data: { name: '钻头', code: 'ZT', description: '凿岩机钻头类零部件', standard_param_count: 40 } }),
    db.part_category.create({ data: { name: '活塞', code: 'HS', description: '凿岩机活塞组件', standard_param_count: 40 } }),
    db.part_category.create({ data: { name: '气缸', code: 'QG', description: '凿岩机气缸组件', standard_param_count: 40 } }),
    db.part_category.create({ data: { name: '阀组', code: 'FZ', description: '凿岩机配气阀组', standard_param_count: 40 } }),
    db.part_category.create({ data: { name: '轴承', code: 'ZC', description: '凿岩机用轴承', standard_param_count: 40 } }),
    db.part_category.create({ data: { name: '密封件', code: 'MF', description: '凿岩机密封组件', standard_param_count: 40 } }),
  ])

  // 3. 设备
  const equipmentList = await Promise.all([
    db.equipment.create({ data: { machine_no: 'YT28-2025-001', model: 'YT28', manufacturer: '天水凿岩机厂', production_date: new Date('2024-06-15'), status: '在用', current_location: '贵州某隧道项目', total_working_hours: 2350 } }),
    db.equipment.create({ data: { machine_no: 'HY200-2025-002', model: 'HY200', manufacturer: '阿特拉斯·科普柯', production_date: new Date('2023-11-20'), status: '维修中', current_location: '维修车间', total_working_hours: 4180 } }),
    db.equipment.create({ data: { machine_no: 'DZ900-2025-003', model: 'DZ900', manufacturer: '山特维克', production_date: new Date('2022-03-10'), status: '库存', current_location: '配件仓库', total_working_hours: 8560 } }),
  ])

  // 4. 零件（12件，每类别2件）
  const parts = await Promise.all([
    db.part.create({ data: { code: 'ZT-001', name: '十字钻头-A1', category_id: categories[0].id, equipment_id: equipmentList[0].id, specification: 'φ48mm', material: '42CrMo+YG15C', supplier: '三一智装', working_hours: 1850, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'ZT-002', name: '球齿钻头-A2', category_id: categories[0].id, equipment_id: equipmentList[0].id, specification: 'φ48mm', material: '40CrNiMo+YG8C', supplier: '徐工供应', working_hours: 1200, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'HS-001', name: '冲击活塞-A1', category_id: categories[1].id, equipment_id: equipmentList[0].id, specification: 'φ120×280mm', material: '20CrMnTi渗碳', supplier: '自有生产', working_hours: 1650, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'HS-002', name: '配气活塞-A2', category_id: categories[1].id, equipment_id: equipmentList[0].id, specification: 'φ100×220mm', material: '40Cr表面淬火', supplier: '自有生产', working_hours: 980, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'QG-001', name: '前缸体-B1', category_id: categories[2].id, equipment_id: equipmentList[1].id, specification: 'φ150×400mm', material: 'ZG270-500', supplier: '自有生产', working_hours: 3200, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'QG-002', name: '后缸体-B2', category_id: categories[2].id, equipment_id: equipmentList[1].id, specification: 'φ150×400mm', material: 'ZG270-500', supplier: '自有生产', working_hours: 3200, status: '待检', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'FZ-001', name: '配气阀组-B1', category_id: categories[3].id, equipment_id: equipmentList[1].id, specification: 'φ60×80mm', material: '40Cr+GCr15', supplier: '中联供应', working_hours: 2800, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'FZ-002', name: '换向阀-B2', category_id: categories[3].id, equipment_id: equipmentList[1].id, specification: 'φ55×70mm', material: '20CrMnTi', supplier: '山推供应', working_hours: 1500, status: '已更换', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'ZC-001', name: '主轴承-C1', category_id: categories[4].id, equipment_id: equipmentList[2].id, specification: '60×90×22mm', material: 'GCr15', supplier: '进口SKF', working_hours: 7500, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'ZC-002', name: '前端轴承-C2', category_id: categories[4].id, equipment_id: equipmentList[2].id, specification: '80×130×28mm', material: 'GCr15SiMn', supplier: '进口NSK', working_hours: 6200, status: '在用', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'MF-001', name: '活塞密封组-C1', category_id: categories[5].id, equipment_id: equipmentList[2].id, specification: 'φ120×φ150mm', material: 'NBR+PU', supplier: '鼎基密封', working_hours: 5400, status: '报废', install_date: new Date('2024-07-01') } }),
    db.part.create({ data: { code: 'MF-002', name: '缸体密封组-C2', category_id: categories[5].id, equipment_id: equipmentList[2].id, specification: 'φ180×φ210mm', material: 'FKM', supplier: '鼎基密封', working_hours: 3800, status: '在用', install_date: new Date('2024-07-01') } }),
  ])

  // 5. 参数模板 + 参数项
  const catCodeMap: Record<string, string> = {}
  for (const c of categories) catCodeMap[c.id] = c.code

  const paramItemIdsByCategory: Record<string, string[]> = {}

  for (const cat of categories) {
    const code = catCodeMap[cat.id]
    const defs = CATEGORY_PARAMS[code]!

    const template = await db.parameter_template.create({
      data: { category_id: cat.id, name: `${cat.name}检测模板`, version: 1 },
    })

    const itemData: any[] = []
    let sortOrder = 0
    for (const [name, pcode, unit, smin, smax, omin, omax] of defs.num) {
      itemData.push({ template_id: template.id, param_name: name, param_code: pcode, unit, data_type: 'number', standard_min: smin, standard_max: smax, optimal_min: omin, optimal_max: omax, sort_order: sortOrder++, options: null })
    }
    for (const [name, pcode, opts] of defs.opt) {
      itemData.push({ template_id: template.id, param_name: name, param_code: pcode, unit: '', data_type: 'option', standard_min: null, standard_max: null, optimal_min: null, optimal_max: null, sort_order: sortOrder++, options: JSON.stringify(opts) })
    }
    await db.parameter_item.createMany({ data: itemData })

    const items = await db.parameter_item.findMany({ where: { template_id: template.id }, orderBy: { sort_order: 'asc' }, select: { id: true } })
    paramItemIdsByCategory[cat.id] = items.map((i) => i.id)
  }

  // 6. 检测记录 + 明细（≥4800）
  const inspectors = ['张伟', '李明', '王芳', '刘强', '陈静']
  const partsByEquip: Record<string, typeof parts> = {}
  for (const p of parts) { if (p.equipment_id) { (partsByEquip[p.equipment_id] ??= []).push(p) } }

  const paramMapByPart: Record<string, string[]> = {}
  for (const p of parts) paramMapByPart[p.id] = paramItemIdsByCategory[p.category_id]

  // 30 次检测：设备1×18 + 设备2×8 + 设备3×4
  const schedule: Array<{ equipment_id: string; date: Date }> = []
  for (let i = 0; i < 18; i++) schedule.push({ equipment_id: equipmentList[0].id, date: new Date(2025, 3, 1 + Math.round((i / 17) * 59)) })
  for (let i = 0; i < 8; i++) schedule.push({ equipment_id: equipmentList[1].id, date: new Date(2025, 3, 1 + Math.round((i / 7) * 59)) })
  for (let i = 0; i < 4; i++) schedule.push({ equipment_id: equipmentList[2].id, date: new Date(2025, 3, 1 + Math.round((i / 3) * 59)) })

  const allParamItems = await db.parameter_item.findMany({ select: { id: true, standard_min: true, standard_max: true, optimal_min: true, optimal_max: true, data_type: true, options: true } })
  const piMap: Record<string, typeof allParamItems[0]> = Object.fromEntries(allParamItems.map((p) => [p.id, p]))

  let recordIdx = 1
  for (const s of schedule) {
    const eqParts = partsByEquip[s.equipment_id] ?? []
    const record = await db.inspection_record.create({
      data: {
        record_no: `JY-2025-${String(recordIdx).padStart(4, '0')}`,
        equipment_id: s.equipment_id,
        inspector: inspectors[Math.floor(Math.random() * inspectors.length)],
        batch_no: `PC-2025${String(s.date.getMonth() + 1).padStart(2, '0')}-${String(Math.ceil(s.date.getDate() / 7)).padStart(2, '0')}`,
        inspection_date: s.date,
        overall_result: '待检',
      },
    })

    const batch: any[] = []
    let qualified = 0, total = 0

    for (const part of eqParts) {
      const pids = paramMapByPart[part.id] ?? []
      for (let pi = 0; pi < pids.length; pi++) {
        const pItem = piMap[pids[pi]]
        if (!pItem) continue
        total++
        if (pItem.data_type === 'option' && pItem.options) {
          const { text, is_qualified, is_optimal } = genOptValue(JSON.parse(pItem.options))
          if (is_qualified) qualified++
          batch.push({ record_id: record.id, part_id: part.id, param_item_id: pids[pi], value_number: null, value_text: text, is_qualified, is_optimal })
        } else {
          const { value, is_qualified, is_optimal } = genNumValue(pItem.standard_min ?? 0, pItem.standard_max ?? 0, pItem.optimal_min ?? 0, pItem.optimal_max ?? 0)
          if (is_qualified) qualified++
          batch.push({ record_id: record.id, part_id: part.id, param_item_id: pids[pi], value_number: value, value_text: null, is_qualified, is_optimal })
        }
      }
    }

    for (let i = 0; i < batch.length; i += 500) {
      await db.inspection_data_item.createMany({ data: batch.slice(i, i + 500) })
    }

    const rate = total > 0 ? qualified / total : 0
    await db.inspection_record.update({ where: { id: record.id }, data: { overall_result: rate >= 0.95 ? '合格' : rate >= 0.85 ? '待复检' : '不合格' } })
    recordIdx++
  }

  // 7. 分析报告
  await db.analysis_report.createMany({
    data: [
      { report_no: 'BG-2025-04-YD001', title: '2025年4月凿岩机零部件质量分析月报', type: '月度分析', period: '2025-04', status: '已发布', author: '张伟', summary: '4月份共完成20次设备检测，覆盖12个零部件，整体合格率91.2%。', conclusion: '1. 加强气缸内壁粗糙度波动管控；2. 钻头钎焊质量稳定。' },
      { report_no: 'BG-2025-05-YD001', title: '2025年5月凿岩机零部件质量分析月报', type: '月度分析', period: '2025-05', status: '已发布', author: '张伟', summary: '5月份整体合格率92.8%，较4月提升1.6个百分点。', conclusion: '建议关注维修设备HY200-002各零件磨损数据。' },
      { report_no: 'BG-2025-Q2-JD001', title: '2025年Q2季度凿岩机零部件全生命周期分析报告', type: '季度分析', period: '2025-Q2', status: '草稿', author: '李明', summary: '第二季度整体质量稳中有升，零部件寿命指标达到设计标准的1.1倍。', conclusion: '建议下季度重点关注高磨损件寿命优化。' },
      { report_no: 'BG-2025-ZX-001', title: '钻头类零部件专项寿命分析报告', type: '专项分析', period: '2025-H1', status: '已发布', author: '王芳', summary: '球齿钻头单位磨损率低于十字钻头32%。', conclusion: '球齿钻头性价比最优，建议高磨损工况优先选用。' },
    ],
  })

  // 8. 任务
  await db.task.createMany({
    data: [
      { title: '整理6月份检测数据台账', description: '汇总6月份所有零部件检测记录，核对数据完整性。', priority: '高', status: '进行中', task_type: '常规', assignee: '张伟', due_date: new Date('2025-07-05') },
      { title: '编制Q2季度分析报告', description: '基于4-6月检测数据完成第二季度全生命周期质量分析报告。', priority: '高', status: '待办', task_type: '常规', assignee: '李明', due_date: new Date('2025-07-10') },
      { title: '供应商质量数据汇总', description: '收集各供应商零部件检测数据，形成质量对比分析表。', priority: '中', status: '待办', task_type: '领导交办', assignee: '王芳', due_date: new Date('2025-07-15') },
      { title: '新检测标准学习培训', description: '组织部门人员学习GB/T 6379测量方法与结果标准。', priority: '低', status: '待办', task_type: '常规', assignee: '刘强', due_date: new Date('2025-07-20') },
      { title: '5月份不合格品原因分析', description: '对5月份不合格品进行分类统计和原因分析。', priority: '紧急', status: '已完成', task_type: '常规', assignee: '陈静', due_date: new Date('2025-07-03') },
    ],
  })

  // 9. 会议 + 决议
  const m1 = await db.meeting.create({ data: { title: '4月份质量分析例会', meeting_date: new Date(2025, 3, 6, 9, 0), location: '三楼会议室A', organizer: '张伟', participants: '张伟,李明,王芳,刘强,陈静', minutes_content: '1. 通报4月检测数据总体情况；2. 讨论气缸内壁粗糙度波动问题；3. 安排5月检测计划。', status: '已完成' } })
  const m2 = await db.meeting.create({ data: { title: '5月份质量分析例会', meeting_date: new Date(2025, 4, 6, 9, 0), location: '三楼会议室A', organizer: '张伟', participants: '张伟,李明,王芳,刘强,陈静', minutes_content: '1. 5月合格率提升至92.8%；2. 维修设备HY200-002送检结果分析；3. 部署球齿钻头寿命验证试验。', status: '已完成' } })
  await db.meeting_resolution.createMany({ data: [
    { meeting_id: m1.id, content: '加强前缸体供应商内壁精加工工艺管控', responsible_person: '王芳', due_date: new Date('2025-04-20'), status: '已完成' },
    { meeting_id: m1.id, content: '编制钻头钎焊质量专项分析报告', responsible_person: '陈静', due_date: new Date('2025-04-15'), status: '已完成' },
    { meeting_id: m2.id, content: '推进球齿钻头与十字钻头对比寿命验证试验', responsible_person: '刘强', due_date: new Date('2025-06-30'), status: '待执行' },
  ] })

  // 10. 文档
  await db.document.createMany({ data: [
    { title: '2025年4月质量分析月报', category: '报告', archived: true },
    { title: '钻头类专项寿命分析报告', category: '报告', archived: true },
  ] })

  // 11. 考勤
  const members = ['张伟', '李明', '王芳', '刘强', '陈静']
  const attData: any[] = []
  for (let month = 4; month <= 5; month++) {
    const dim = month === 4 ? 30 : 31
    for (let day = 1; day <= dim; day++) {
      const dow = new Date(2025, month - 1, day).getDay()
      if (dow === 0 || dow === 6) continue
      const date = new Date(2025, month - 1, day)
      for (const m of members) {
        const r = Math.random()
        attData.push({ date, member_name: m, status: r < 0.88 ? '出勤' : r < 0.93 ? '请假' : r < 0.97 ? '迟到' : '出差', remark: r < 0.88 ? null : r < 0.93 ? '事假' : r < 0.97 ? '迟到10分钟' : '供应商审核' })
      }
    }
  }
  for (let i = 0; i < attData.length; i += 200) await db.attendance_record.createMany({ data: attData.slice(i, i + 200) })

  // 统计
  const elapsed = Date.now() - t0
  const counts = {
    part_category: await db.part_category.count(),
    equipment: await db.equipment.count(),
    part: await db.part.count(),
    parameter_template: await db.parameter_template.count(),
    parameter_item: await db.parameter_item.count(),
    inspection_record: await db.inspection_record.count(),
    inspection_data_item: await db.inspection_data_item.count(),
    analysis_report: await db.analysis_report.count(),
    task: await db.task.count(),
    meeting: await db.meeting.count(),
    meeting_resolution: await db.meeting_resolution.count(),
    document: await db.document.count(),
    attendance_record: await db.attendance_record.count(),
  }

  console.log(JSON.stringify({ success: true, message: '种子数据创建完成', elapsed: `${(elapsed / 1000).toFixed(1)}s`, counts }, null, 2))
  await db.$disconnect()
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })