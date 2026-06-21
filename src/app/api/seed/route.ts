import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================================
//  参数定义：每类别 40 个参数项
// ============================================================

interface ParamDef {
  paramName: string
  paramCode: string
  unit: string
  dataType: string
  standardMin: number
  standardMax: number
  optimalMin: number
  optimalMax: number
}

/**
 * 6 大类零部件的检测参数定义
 * 每类 40 项，涵盖尺寸、硬度、粗糙度、形位公差、探伤、试验等
 */
const CATEGORY_PARAMS: Record<string, ParamDef[]> = {
  ZT: [
    { paramName: '外径D1', paramCode: 'OD_D1', unit: 'mm', dataType: 'number', standardMin: 47.5, standardMax: 48.5, optimalMin: 47.8, optimalMax: 48.2 },
    { paramName: '外径D2', paramCode: 'OD_D2', unit: 'mm', dataType: 'number', standardMin: 47.5, standardMax: 48.5, optimalMin: 47.9, optimalMax: 48.1 },
    { paramName: '内径d1', paramCode: 'ID_d1', unit: 'mm', dataType: 'number', standardMin: 18.0, standardMax: 19.0, optimalMin: 18.3, optimalMax: 18.7 },
    { paramName: '内径d2', paramCode: 'ID_d2', unit: 'mm', dataType: 'number', standardMin: 18.0, standardMax: 19.0, optimalMin: 18.3, optimalMax: 18.7 },
    { paramName: '总长度L', paramCode: 'LEN_L', unit: 'mm', dataType: 'number', standardMin: 280, standardMax: 285, optimalMin: 281, optimalMax: 283 },
    { paramName: '头部长度L1', paramCode: 'LEN_L1', unit: 'mm', dataType: 'number', standardMin: 85, standardMax: 90, optimalMin: 86, optimalMax: 89 },
    { paramName: '螺纹长度L2', paramCode: 'LEN_L2', unit: 'mm', dataType: 'number', standardMin: 50, standardMax: 55, optimalMin: 51, optimalMax: 54 },
    { paramName: '重量W', paramCode: 'WT_W', unit: 'g', dataType: 'number', standardMin: 1850, standardMax: 1950, optimalMin: 1880, optimalMax: 1920 },
    { paramName: '硬度HRC-齿部', paramCode: 'HRC_TOOTH', unit: 'HRC', dataType: 'number', standardMin: 38, standardMax: 45, optimalMin: 40, optimalMax: 43 },
    { paramName: '硬度HRC-体部', paramCode: 'HRC_BODY', unit: 'HRC', dataType: 'number', standardMin: 35, standardMax: 42, optimalMin: 37, optimalMax: 40 },
    { paramName: '粗糙度Ra-外圆', paramCode: 'RA_OD', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 3.2, optimalMin: 0, optimalMax: 1.6 },
    { paramName: '粗糙度Ra-内孔', paramCode: 'RA_ID', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 3.2, optimalMin: 0, optimalMax: 1.6 },
    { paramName: '合金齿高度h', paramCode: 'TOOTH_H', unit: 'mm', dataType: 'number', standardMin: 5.0, standardMax: 6.0, optimalMin: 5.3, optimalMax: 5.7 },
    { paramName: '齿间距p', paramCode: 'TOOTH_P', unit: 'mm', dataType: 'number', standardMin: 12.0, standardMax: 13.0, optimalMin: 12.3, optimalMax: 12.7 },
    { paramName: '排粉槽深度t', paramCode: 'GROOVE_T', unit: 'mm', dataType: 'number', standardMin: 3.0, standardMax: 4.0, optimalMin: 3.3, optimalMax: 3.7 },
    { paramName: '排粉槽宽度b', paramCode: 'GROOVE_B', unit: 'mm', dataType: 'number', standardMin: 6.0, standardMax: 7.0, optimalMin: 6.3, optimalMax: 6.7 },
    { paramName: '冲击端面角度α', paramCode: 'ANGLE_A', unit: '°', dataType: 'number', standardMin: 108, standardMax: 112, optimalMin: 109, optimalMax: 111 },
    { paramName: '焊缝质量', paramCode: 'WELD_Q', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '耐磨层厚度', paramCode: 'WEAR_THK', unit: 'mm', dataType: 'number', standardMin: 0.8, standardMax: 1.5, optimalMin: 1.0, optimalMax: 1.3 },
    { paramName: '端面跳动T', paramCode: 'RUNOUT_T', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.05, optimalMin: 0, optimalMax: 0.03 },
    { paramName: '径向跳动R', paramCode: 'RUNOUT_R', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.04, optimalMin: 0, optimalMax: 0.02 },
    { paramName: '直线度', paramCode: 'STRAIGHT', unit: 'mm/m', dataType: 'number', standardMin: 0, standardMax: 0.08, optimalMin: 0, optimalMax: 0.04 },
    { paramName: '同轴度', paramCode: 'CONCEN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.06, optimalMin: 0, optimalMax: 0.03 },
    { paramName: '圆柱度', paramCode: 'CYLIN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.05, optimalMin: 0, optimalMax: 0.025 },
    { paramName: '圆度', paramCode: 'ROUND', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.04, optimalMin: 0, optimalMax: 0.02 },
    { paramName: '螺纹中径', paramCode: 'THREAD_PD', unit: 'mm', dataType: 'number', standardMin: 21.5, standardMax: 22.0, optimalMin: 21.7, optimalMax: 21.9 },
    { paramName: '螺纹螺距', paramCode: 'THREAD_P', unit: 'mm', dataType: 'number', standardMin: 2.28, standardMax: 2.32, optimalMin: 2.29, optimalMax: 2.31 },
    { paramName: '碳化钨含量', paramCode: 'WC_PCT', unit: '%', dataType: 'number', standardMin: 85, standardMax: 92, optimalMin: 87, optimalMax: 91 },
    { paramName: '钴含量', paramCode: 'CO_PCT', unit: '%', dataType: 'number', standardMin: 8, standardMax: 12, optimalMin: 9, optimalMax: 11 },
    { paramName: '抗弯强度', paramCode: 'BEND_STR', unit: 'MPa', dataType: 'number', standardMin: 1800, standardMax: 2500, optimalMin: 2000, optimalMax: 2400 },
    { paramName: '冲击韧性', paramCode: 'IMPACT', unit: 'J/cm²', dataType: 'number', standardMin: 3.0, standardMax: 6.0, optimalMin: 4.0, optimalMax: 5.5 },
    { paramName: '金相组织评级', paramCode: 'METAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '脱碳层深度', paramCode: 'DECARB', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.15, optimalMin: 0, optimalMax: 0.08 },
    { paramName: '外观检查', paramCode: 'VISUAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '磁粉探伤', paramCode: 'MT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '超声波探伤', paramCode: 'UT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '尺寸稳定性', paramCode: 'DIM_STAB', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '装配间隙', paramCode: 'FIT_GAP', unit: 'mm', dataType: 'number', standardMin: 0.02, standardMax: 0.10, optimalMin: 0.04, optimalMax: 0.08 },
    { paramName: '动平衡量', paramCode: 'BALANCE', unit: 'g·mm', dataType: 'number', standardMin: 0, standardMax: 15, optimalMin: 0, optimalMax: 8 },
    { paramName: '综合判定', paramCode: 'VERDICT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
  ],
  HS: [
    { paramName: '外径D', paramCode: 'OD_D', unit: 'mm', dataType: 'number', standardMin: 119.5, standardMax: 120.5, optimalMin: 119.8, optimalMax: 120.2 },
    { paramName: '内径d', paramCode: 'ID_d', unit: 'mm', dataType: 'number', standardMin: 58.0, standardMax: 60.0, optimalMin: 58.5, optimalMax: 59.5 },
    { paramName: '总长度L', paramCode: 'LEN_L', unit: 'mm', dataType: 'number', standardMin: 278, standardMax: 282, optimalMin: 279, optimalMax: 281 },
    { paramName: '活塞杆直径D1', paramCode: 'ROD_D1', unit: 'mm', dataType: 'number', standardMin: 59.5, standardMax: 60.5, optimalMin: 59.8, optimalMax: 60.2 },
    { paramName: '活塞头直径D2', paramCode: 'HEAD_D2', unit: 'mm', dataType: 'number', standardMin: 119.0, standardMax: 120.0, optimalMin: 119.3, optimalMax: 119.7 },
    { paramName: '活塞头厚度H1', paramCode: 'HEAD_H1', unit: 'mm', dataType: 'number', standardMin: 48, standardMax: 52, optimalMin: 49, optimalMax: 51 },
    { paramName: '活塞杆长度H2', paramCode: 'ROD_H2', unit: 'mm', dataType: 'number', standardMin: 225, standardMax: 235, optimalMin: 228, optimalMax: 232 },
    { paramName: '密封槽宽度b', paramCode: 'SEAL_B', unit: 'mm', dataType: 'number', standardMin: 4.0, standardMax: 4.5, optimalMin: 4.1, optimalMax: 4.4 },
    { paramName: '密封槽深度t', paramCode: 'SEAL_T', unit: 'mm', dataType: 'number', standardMin: 2.5, standardMax: 3.0, optimalMin: 2.6, optimalMax: 2.9 },
    { paramName: '密封槽数量', paramCode: 'SEAL_N', unit: '个', dataType: 'number', standardMin: 3, standardMax: 5, optimalMin: 3, optimalMax: 5 },
    { paramName: '重量W', paramCode: 'WT_W', unit: 'kg', dataType: 'number', standardMin: 8.5, standardMax: 9.5, optimalMin: 8.8, optimalMax: 9.2 },
    { paramName: '硬度HRC-表面', paramCode: 'HRC_SURF', unit: 'HRC', dataType: 'number', standardMin: 58, standardMax: 64, optimalMin: 60, optimalMax: 63 },
    { paramName: '硬度HRC-芯部', paramCode: 'HRC_CORE', unit: 'HRC', dataType: 'number', standardMin: 30, standardMax: 38, optimalMin: 32, optimalMax: 36 },
    { paramName: '渗碳层深度', paramCode: 'CARB_DP', unit: 'mm', dataType: 'number', standardMin: 0.8, standardMax: 1.5, optimalMin: 1.0, optimalMax: 1.3 },
    { paramName: '粗糙度Ra-外圆', paramCode: 'RA_OD', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.8, optimalMin: 0, optimalMax: 0.4 },
    { paramName: '粗糙度Ra-内孔', paramCode: 'RA_ID', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 1.6, optimalMin: 0, optimalMax: 0.8 },
    { paramName: '粗糙度Ra-杆部', paramCode: 'RA_ROD', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.4, optimalMin: 0, optimalMax: 0.2 },
    { paramName: '圆柱度', paramCode: 'CYLIN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.03, optimalMin: 0, optimalMax: 0.015 },
    { paramName: '圆度', paramCode: 'ROUND', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '直线度', paramCode: 'STRAIGHT', unit: 'mm/m', dataType: 'number', standardMin: 0, standardMax: 0.04, optimalMin: 0, optimalMax: 0.02 },
    { paramName: '同轴度', paramCode: 'CONCEN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.03, optimalMin: 0, optimalMax: 0.015 },
    { paramName: '径向跳动', paramCode: 'RUNOUT_R', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.025, optimalMin: 0, optimalMax: 0.012 },
    { paramName: '端面跳动', paramCode: 'RUNOUT_T', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '螺纹规格检查', paramCode: 'THREAD_CHK', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '螺纹中径', paramCode: 'THREAD_PD', unit: 'mm', dataType: 'number', standardMin: 59.0, standardMax: 60.0, optimalMin: 59.3, optimalMax: 59.7 },
    { paramName: '密封面平面度', paramCode: 'SEAL_FLAT', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '密封面粗糙度', paramCode: 'RA_SEAL', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.8, optimalMin: 0, optimalMax: 0.4 },
    { paramName: '磁粉探伤', paramCode: 'MT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '超声波探伤', paramCode: 'UT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '金相组织', paramCode: 'METAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '抗拉强度', paramCode: 'TENSILE', unit: 'MPa', dataType: 'number', standardMin: 1100, standardMax: 1400, optimalMin: 1200, optimalMax: 1350 },
    { paramName: '屈服强度', paramCode: 'YIELD', unit: 'MPa', dataType: 'number', standardMin: 850, standardMax: 1100, optimalMin: 900, optimalMax: 1050 },
    { paramName: '延伸率', paramCode: 'ELONG', unit: '%', dataType: 'number', standardMin: 10, standardMax: 16, optimalMin: 12, optimalMax: 15 },
    { paramName: '冲击韧性', paramCode: 'IMPACT', unit: 'J/cm²', dataType: 'number', standardMin: 60, standardMax: 100, optimalMin: 70, optimalMax: 95 },
    { paramName: '疲劳寿命', paramCode: 'FATIGUE', unit: '万次', dataType: 'number', standardMin: 50, standardMax: 120, optimalMin: 80, optimalMax: 110 },
    { paramName: '耐磨试验', paramCode: 'WEAR_TST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '外观检查', paramCode: 'VISUAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '装配检验', paramCode: 'ASSY_CHK', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '尺寸稳定性', paramCode: 'DIM_STAB', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.015, optimalMin: 0, optimalMax: 0.008 },
    { paramName: '综合判定', paramCode: 'VERDICT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
  ],
  QG: [
    { paramName: '缸体内径D', paramCode: 'CYL_ID', unit: 'mm', dataType: 'number', standardMin: 119.8, standardMax: 120.2, optimalMin: 119.9, optimalMax: 120.1 },
    { paramName: '缸体外径D1', paramCode: 'CYL_OD', unit: 'mm', dataType: 'number', standardMin: 149.0, standardMax: 151.0, optimalMin: 149.5, optimalMax: 150.5 },
    { paramName: '总长度L', paramCode: 'LEN_L', unit: 'mm', dataType: 'number', standardMin: 398, standardMax: 402, optimalMin: 399, optimalMax: 401 },
    { paramName: '缸盖厚度H1', paramCode: 'HEAD_H1', unit: 'mm', dataType: 'number', standardMin: 38, standardMax: 42, optimalMin: 39, optimalMax: 41 },
    { paramName: '法兰外径D2', paramCode: 'FLG_OD', unit: 'mm', dataType: 'number', standardMin: 179.0, standardMax: 181.0, optimalMin: 179.5, optimalMax: 180.5 },
    { paramName: '法兰厚度H2', paramCode: 'FLG_H2', unit: 'mm', dataType: 'number', standardMin: 18, standardMax: 22, optimalMin: 19, optimalMax: 21 },
    { paramName: '螺栓孔分布圆D3', paramCode: 'BOLT_PCD', unit: 'mm', dataType: 'number', standardMin: 168, standardMax: 172, optimalMin: 169, optimalMax: 171 },
    { paramName: '螺栓孔直径d', paramCode: 'BOLT_D', unit: 'mm', dataType: 'number', standardMin: 12.5, standardMax: 13.5, optimalMin: 12.8, optimalMax: 13.2 },
    { paramName: '螺栓孔数量', paramCode: 'BOLT_N', unit: '个', dataType: 'number', standardMin: 6, standardMax: 8, optimalMin: 6, optimalMax: 8 },
    { paramName: '配气孔直径d1', paramCode: 'GAS_D', unit: 'mm', dataType: 'number', standardMin: 8.0, standardMax: 9.0, optimalMin: 8.3, optimalMax: 8.7 },
    { paramName: '配气孔位置度', paramCode: 'GAS_POS', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.15, optimalMin: 0, optimalMax: 0.08 },
    { paramName: '进气口直径d2', paramCode: 'IN_D', unit: 'mm', dataType: 'number', standardMin: 24.5, standardMax: 25.5, optimalMin: 24.8, optimalMax: 25.2 },
    { paramName: '排气口直径d3', paramCode: 'OUT_D', unit: 'mm', dataType: 'number', standardMin: 19.5, standardMax: 20.5, optimalMin: 19.8, optimalMax: 20.2 },
    { paramName: '重量W', paramCode: 'WT_W', unit: 'kg', dataType: 'number', standardMin: 32, standardMax: 36, optimalMin: 33, optimalMax: 35 },
    { paramName: '硬度HRC-内壁', paramCode: 'HRC_IN', unit: 'HRC', dataType: 'number', standardMin: 45, standardMax: 55, optimalMin: 48, optimalMax: 52 },
    { paramName: '硬度HRC-外壁', paramCode: 'HRC_OUT', unit: 'HRC', dataType: 'number', standardMin: 22, standardMax: 30, optimalMin: 24, optimalMax: 28 },
    { paramName: '渗氮层深度', paramCode: 'NITR_DP', unit: 'mm', dataType: 'number', standardMin: 0.3, standardMax: 0.6, optimalMin: 0.35, optimalMax: 0.55 },
    { paramName: '粗糙度Ra-内壁', paramCode: 'RA_IN', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.8, optimalMin: 0, optimalMax: 0.4 },
    { paramName: '粗糙度Ra-外壁', paramCode: 'RA_OUT', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 3.2, optimalMin: 0, optimalMax: 1.6 },
    { paramName: '圆柱度', paramCode: 'CYLIN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.025, optimalMin: 0, optimalMax: 0.012 },
    { paramName: '圆度', paramCode: 'ROUND', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.015, optimalMin: 0, optimalMax: 0.008 },
    { paramName: '直线度', paramCode: 'STRAIGHT', unit: 'mm/m', dataType: 'number', standardMin: 0, standardMax: 0.05, optimalMin: 0, optimalMax: 0.025 },
    { paramName: '同轴度', paramCode: 'CONCEN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.04, optimalMin: 0, optimalMax: 0.02 },
    { paramName: '内壁径向跳动', paramCode: 'RUNOUT_IN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '法兰端面跳动', paramCode: 'RUNOUT_FLG', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.03, optimalMin: 0, optimalMax: 0.015 },
    { paramName: '法兰端面平面度', paramCode: 'FLG_FLAT', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '螺纹孔精度', paramCode: 'THREAD_ACC', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '磁粉探伤', paramCode: 'MT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '超声波探伤', paramCode: 'UT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '水压试验', paramCode: 'HYDRO_TST', unit: 'MPa', dataType: 'number', standardMin: 1.2, standardMax: 1.5, optimalMin: 1.25, optimalMax: 1.45 },
    { paramName: '气密性试验', paramCode: 'AIR_TST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '金相组织', paramCode: 'METAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '抗拉强度', paramCode: 'TENSILE', unit: 'MPa', dataType: 'number', standardMin: 500, standardMax: 650, optimalMin: 530, optimalMax: 620 },
    { paramName: '延伸率', paramCode: 'ELONG', unit: '%', dataType: 'number', standardMin: 18, standardMax: 28, optimalMin: 20, optimalMax: 26 },
    { paramName: '表面处理质量', paramCode: 'SURF_TRT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '装配尺寸检验', paramCode: 'ASSY_DIM', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '外观检查', paramCode: 'VISUAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '尺寸链计算', paramCode: 'DIM_CHAIN', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '寿命试验', paramCode: 'LIFE_TST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '综合判定', paramCode: 'VERDICT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
  ],
  FZ: [
    { paramName: '阀体外径D', paramCode: 'VALVE_OD', unit: 'mm', dataType: 'number', standardMin: 59.5, standardMax: 60.5, optimalMin: 59.8, optimalMax: 60.2 },
    { paramName: '阀体内径d', paramCode: 'VALVE_ID', unit: 'mm', dataType: 'number', standardMin: 28.0, standardMax: 29.0, optimalMin: 28.3, optimalMax: 28.7 },
    { paramName: '阀芯直径D1', paramCode: 'CORE_D', unit: 'mm', dataType: 'number', standardMin: 27.5, standardMax: 28.5, optimalMin: 27.8, optimalMax: 28.2 },
    { paramName: '阀体长度L', paramCode: 'VALVE_L', unit: 'mm', dataType: 'number', standardMin: 78, standardMax: 82, optimalMin: 79, optimalMax: 81 },
    { paramName: '阀芯长度L1', paramCode: 'CORE_L', unit: 'mm', dataType: 'number', standardMin: 58, standardMax: 62, optimalMin: 59, optimalMax: 61 },
    { paramName: '阀口直径d1', paramCode: 'PORT_D', unit: 'mm', dataType: 'number', standardMin: 8.0, standardMax: 9.0, optimalMin: 8.3, optimalMax: 8.7 },
    { paramName: '密封面宽度b', paramCode: 'SEAL_B', unit: 'mm', dataType: 'number', standardMin: 1.5, standardMax: 2.5, optimalMin: 1.8, optimalMax: 2.2 },
    { paramName: '弹簧自由高度H', paramCode: 'SPR_H', unit: 'mm', dataType: 'number', standardMin: 24, standardMax: 28, optimalMin: 25, optimalMax: 27 },
    { paramName: '弹簧刚度K', paramCode: 'SPR_K', unit: 'N/mm', dataType: 'number', standardMin: 2.5, standardMax: 3.5, optimalMin: 2.8, optimalMax: 3.2 },
    { paramName: '弹簧预压缩量', paramCode: 'SPR_PRE', unit: 'mm', dataType: 'number', standardMin: 4, standardMax: 8, optimalMin: 5, optimalMax: 7 },
    { paramName: '重量W', paramCode: 'WT_W', unit: 'g', dataType: 'number', standardMin: 380, standardMax: 420, optimalMin: 390, optimalMax: 410 },
    { paramName: '硬度HRC-阀芯', paramCode: 'HRC_CORE', unit: 'HRC', dataType: 'number', standardMin: 58, standardMax: 64, optimalMin: 60, optimalMax: 63 },
    { paramName: '硬度HRC-阀体', paramCode: 'HRC_BODY', unit: 'HRC', dataType: 'number', standardMin: 28, standardMax: 35, optimalMin: 30, optimalMax: 33 },
    { paramName: '粗糙度Ra-密封面', paramCode: 'RA_SEAL', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.4, optimalMin: 0, optimalMax: 0.2 },
    { paramName: '粗糙度Ra-阀芯', paramCode: 'RA_CORE', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.8, optimalMin: 0, optimalMax: 0.4 },
    { paramName: '粗糙度Ra-阀体', paramCode: 'RA_BODY', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 1.6, optimalMin: 0, optimalMax: 0.8 },
    { paramName: '圆柱度-阀芯', paramCode: 'CYLIN_CORE', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.01, optimalMin: 0, optimalMax: 0.005 },
    { paramName: '圆柱度-阀体', paramCode: 'CYLIN_BODY', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '圆度-阀芯', paramCode: 'ROUND_CORE', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.008, optimalMin: 0, optimalMax: 0.004 },
    { paramName: '圆度-阀体', paramCode: 'ROUND_BODY', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.015, optimalMin: 0, optimalMax: 0.008 },
    { paramName: '同轴度', paramCode: 'CONCEN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.02, optimalMin: 0, optimalMax: 0.01 },
    { paramName: '密封面平面度', paramCode: 'SEAL_FLAT', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.01, optimalMin: 0, optimalMax: 0.005 },
    { paramName: '阀芯直线度', paramCode: 'STRAIGHT_C', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.015, optimalMin: 0, optimalMax: 0.008 },
    { paramName: '配合间隙', paramCode: 'FIT_GAP', unit: 'mm', dataType: 'number', standardMin: 0.02, standardMax: 0.08, optimalMin: 0.03, optimalMax: 0.06 },
    { paramName: '磁粉探伤', paramCode: 'MT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '超声波探伤', paramCode: 'UT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '金相组织', paramCode: 'METAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '抗拉强度', paramCode: 'TENSILE', unit: 'MPa', dataType: 'number', standardMin: 900, standardMax: 1200, optimalMin: 1000, optimalMax: 1150 },
    { paramName: '屈服强度', paramCode: 'YIELD', unit: 'MPa', dataType: 'number', standardMin: 700, standardMax: 950, optimalMin: 750, optimalMax: 900 },
    { paramName: '延伸率', paramCode: 'ELONG', unit: '%', dataType: 'number', standardMin: 12, standardMax: 20, optimalMin: 14, optimalMax: 18 },
    { paramName: '冲击韧性', paramCode: 'IMPACT', unit: 'J/cm²', dataType: 'number', standardMin: 50, standardMax: 80, optimalMin: 60, optimalMax: 75 },
    { paramName: '疲劳寿命', paramCode: 'FATIGUE', unit: '万次', dataType: 'number', standardMin: 30, standardMax: 80, optimalMin: 50, optimalMax: 70 },
    { paramName: '弹簧疲劳试验', paramCode: 'SPR_FAT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '密封性试验', paramCode: 'SEAL_TST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '动作灵活性', paramCode: 'ACTION_CHK', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '外观检查', paramCode: 'VISUAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '装配检验', paramCode: 'ASSY_CHK', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '尺寸稳定性', paramCode: 'DIM_STAB', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.01, optimalMin: 0, optimalMax: 0.005 },
    { paramName: '清洁度', paramCode: 'CLEAN', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '综合判定', paramCode: 'VERDICT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
  ],
  ZC: [
    { paramName: '内径d', paramCode: 'ID_d', unit: 'mm', dataType: 'number', standardMin: 59.95, standardMax: 60.05, optimalMin: 59.98, optimalMax: 60.02 },
    { paramName: '外径D', paramCode: 'OD_D', unit: 'mm', dataType: 'number', standardMin: 89.9, standardMax: 90.1, optimalMin: 89.95, optimalMax: 90.05 },
    { paramName: '宽度B', paramCode: 'WD_B', unit: 'mm', dataType: 'number', standardMin: 21.9, standardMax: 22.1, optimalMin: 21.95, optimalMax: 22.05 },
    { paramName: '内圈宽度B1', paramCode: 'IR_B', unit: 'mm', dataType: 'number', standardMin: 21.9, standardMax: 22.1, optimalMin: 21.95, optimalMax: 22.05 },
    { paramName: '外圈宽度B2', paramCode: 'OR_B', unit: 'mm', dataType: 'number', standardMin: 21.9, standardMax: 22.1, optimalMin: 21.95, optimalMax: 22.05 },
    { paramName: '滚子直径', paramCode: 'ROLLER_D', unit: 'mm', dataType: 'number', standardMin: 8.9, standardMax: 9.1, optimalMin: 8.95, optimalMax: 9.05 },
    { paramName: '滚子长度', paramCode: 'ROLLER_L', unit: 'mm', dataType: 'number', standardMin: 12.9, standardMax: 13.1, optimalMin: 12.95, optimalMax: 13.05 },
    { paramName: '滚子数量', paramCode: 'ROLLER_N', unit: '个', dataType: 'number', standardMin: 9, standardMax: 11, optimalMin: 9, optimalMax: 11 },
    { paramName: '保持架宽度', paramCode: 'CAGE_W', unit: 'mm', dataType: 'number', standardMin: 3.5, standardMax: 4.5, optimalMin: 3.8, optimalMax: 4.2 },
    { paramName: '保持架外径', paramCode: 'CAGE_OD', unit: 'mm', dataType: 'number', standardMin: 74, standardMax: 76, optimalMin: 74.5, optimalMax: 75.5 },
    { paramName: '重量W', paramCode: 'WT_W', unit: 'g', dataType: 'number', standardMin: 380, standardMax: 420, optimalMin: 390, optimalMax: 410 },
    { paramName: '硬度HRC-内圈', paramCode: 'HRC_IR', unit: 'HRC', dataType: 'number', standardMin: 60, standardMax: 65, optimalMin: 61, optimalMax: 64 },
    { paramName: '硬度HRC-外圈', paramCode: 'HRC_OR', unit: 'HRC', dataType: 'number', standardMin: 58, standardMax: 63, optimalMin: 59, optimalMax: 62 },
    { paramName: '硬度HRC-滚子', paramCode: 'HRC_RLR', unit: 'HRC', dataType: 'number', standardMin: 62, standardMax: 66, optimalMin: 63, optimalMax: 65 },
    { paramName: '粗糙度Ra-内径', paramCode: 'RA_ID', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.4, optimalMin: 0, optimalMax: 0.2 },
    { paramName: '粗糙度Ra-外径', paramCode: 'RA_OD', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.4, optimalMin: 0, optimalMax: 0.2 },
    { paramName: '粗糙度Ra-端面', paramCode: 'RA_FACE', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 0.8, optimalMin: 0, optimalMax: 0.4 },
    { paramName: '内圈圆柱度', paramCode: 'CYLIN_IR', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.008, optimalMin: 0, optimalMax: 0.004 },
    { paramName: '外圈圆柱度', paramCode: 'CYLIN_OR', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.01, optimalMin: 0, optimalMax: 0.005 },
    { paramName: '内圈圆度', paramCode: 'ROUND_IR', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.006, optimalMin: 0, optimalMax: 0.003 },
    { paramName: '外圈圆度', paramCode: 'ROUND_OR', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.008, optimalMin: 0, optimalMax: 0.004 },
    { paramName: '内圈径向跳动', paramCode: 'RUNOUT_IR', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.01, optimalMin: 0, optimalMax: 0.005 },
    { paramName: '外圈径向跳动', paramCode: 'RUNOUT_OR', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.015, optimalMin: 0, optimalMax: 0.008 },
    { paramName: '轴向游隙', paramCode: 'AXIAL_CLR', unit: 'mm', dataType: 'number', standardMin: 0.05, standardMax: 0.15, optimalMin: 0.08, optimalMax: 0.12 },
    { paramName: '径向游隙', paramCode: 'RAD_CLR', unit: 'mm', dataType: 'number', standardMin: 0.02, standardMax: 0.06, optimalMin: 0.03, optimalMax: 0.05 },
    { paramName: '滚子圆度', paramCode: 'ROUND_RLR', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.003, optimalMin: 0, optimalMax: 0.0015 },
    { paramName: '滚子直径差', paramCode: 'RLR_DIFF', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.005, optimalMin: 0, optimalMax: 0.002 },
    { paramName: '磁粉探伤', paramCode: 'MT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '超声波探伤', paramCode: 'UT_TEST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '金相组织', paramCode: 'METAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '抗拉强度', paramCode: 'TENSILE', unit: 'MPa', dataType: 'number', standardMin: 1800, standardMax: 2200, optimalMin: 1900, optimalMax: 2100 },
    { paramName: '冲击韧性', paramCode: 'IMPACT', unit: 'J/cm²', dataType: 'number', standardMin: 20, standardMax: 40, optimalMin: 25, optimalMax: 35 },
    { paramName: '疲劳寿命', paramCode: 'FATIGUE', unit: '万次', dataType: 'number', standardMin: 100, standardMax: 300, optimalMin: 150, optimalMax: 280 },
    { paramName: '振动测试', paramCode: 'VIB_TST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '温升试验', paramCode: 'TEMP_TST', unit: '°C', dataType: 'number', standardMin: 0, standardMax: 35, optimalMin: 0, optimalMax: 25 },
    { paramName: '外观检查', paramCode: 'VISUAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '装配检验', paramCode: 'ASSY_CHK', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '防锈处理', paramCode: 'RUST_TRT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '清洁度', paramCode: 'CLEAN', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '综合判定', paramCode: 'VERDICT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
  ],
  MF: [
    { paramName: '内径d', paramCode: 'ID_d', unit: 'mm', dataType: 'number', standardMin: 59.5, standardMax: 60.5, optimalMin: 59.7, optimalMax: 60.3 },
    { paramName: '外径D', paramCode: 'OD_D', unit: 'mm', dataType: 'number', standardMin: 79.0, standardMax: 81.0, optimalMin: 79.3, optimalMax: 80.7 },
    { paramName: '截面直径W', paramCode: 'SEC_W', unit: 'mm', dataType: 'number', standardMin: 9.5, standardMax: 10.5, optimalMin: 9.7, optimalMax: 10.3 },
    { paramName: '自由内径', paramCode: 'FREE_ID', unit: 'mm', dataType: 'number', standardMin: 55, standardMax: 58, optimalMin: 56, optimalMax: 57 },
    { paramName: '自由外径', paramCode: 'FREE_OD', unit: 'mm', dataType: 'number', standardMin: 85, standardMax: 90, optimalMin: 86, optimalMax: 89 },
    { paramName: '截面高度H', paramCode: 'SEC_H', unit: 'mm', dataType: 'number', standardMin: 9.5, standardMax: 10.5, optimalMin: 9.8, optimalMax: 10.2 },
    { paramName: '唇口厚度', paramCode: 'LIP_THK', unit: 'mm', dataType: 'number', standardMin: 0.8, standardMax: 1.5, optimalMin: 1.0, optimalMax: 1.3 },
    { paramName: '唇口角度', paramCode: 'LIP_ANG', unit: '°', dataType: 'number', standardMin: 20, standardMax: 30, optimalMin: 22, optimalMax: 28 },
    { paramName: '背部厚度', paramCode: 'BACK_THK', unit: 'mm', dataType: 'number', standardMin: 2.0, standardMax: 3.0, optimalMin: 2.3, optimalMax: 2.7 },
    { paramName: '弹簧槽直径', paramCode: 'SPR_GROOVE', unit: 'mm', dataType: 'number', standardMin: 1.0, standardMax: 1.5, optimalMin: 1.1, optimalMax: 1.4 },
    { paramName: '弹簧直径', paramCode: 'SPR_D', unit: 'mm', dataType: 'number', standardMin: 0.8, standardMax: 1.2, optimalMin: 0.9, optimalMax: 1.1 },
    { paramName: '重量W', paramCode: 'WT_W', unit: 'g', dataType: 'number', standardMin: 28, standardMax: 35, optimalMin: 30, optimalMax: 33 },
    { paramName: '硬度IRHD', paramCode: 'IRHD', unit: 'IRHD', dataType: 'number', standardMin: 70, standardMax: 90, optimalMin: 75, optimalMax: 85 },
    { paramName: '硬度-唇部', paramCode: 'HRC_LIP', unit: 'IRHD', dataType: 'number', standardMin: 75, standardMax: 92, optimalMin: 78, optimalMax: 88 },
    { paramName: '硬度-体部', paramCode: 'HRC_BDY', unit: 'IRHD', dataType: 'number', standardMin: 65, standardMax: 85, optimalMin: 70, optimalMax: 80 },
    { paramName: '拉伸强度', paramCode: 'TENSILE', unit: 'MPa', dataType: 'number', standardMin: 10, standardMax: 25, optimalMin: 15, optimalMax: 22 },
    { paramName: '扯断伸长率', paramCode: 'ELONG', unit: '%', dataType: 'number', standardMin: 200, standardMax: 500, optimalMin: 300, optimalMax: 450 },
    { paramName: '压缩永久变形', paramCode: 'COMP_DEF', unit: '%', dataType: 'number', standardMin: 0, standardMax: 30, optimalMin: 0, optimalMax: 20 },
    { paramName: '热空气老化', paramCode: 'AGING', unit: '°C', dataType: 'number', standardMin: 100, standardMax: 120, optimalMin: 105, optimalMax: 115 },
    { paramName: '压缩变形量', paramCode: 'COMP_AMT', unit: '%', dataType: 'number', standardMin: 5, standardMax: 25, optimalMin: 8, optimalMax: 18 },
    { paramName: '回弹率', paramCode: 'REBOUND', unit: '%', dataType: 'number', standardMin: 40, standardMax: 80, optimalMin: 55, optimalMax: 75 },
    { paramName: '摩擦系数', paramCode: 'FRICTION', unit: '', dataType: 'number', standardMin: 0.2, standardMax: 0.6, optimalMin: 0.3, optimalMax: 0.5 },
    { paramName: '耐压试验', paramCode: 'PRES_TST', unit: 'MPa', dataType: 'number', standardMin: 1.0, standardMax: 1.5, optimalMin: 1.1, optimalMax: 1.4 },
    { paramName: '泄漏量', paramCode: 'LEAKAGE', unit: 'ml/h', dataType: 'number', standardMin: 0, standardMax: 5, optimalMin: 0, optimalMax: 2 },
    { paramName: '外观检查', paramCode: 'VISUAL', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '尺寸稳定性', paramCode: 'DIM_STAB', unit: '%', dataType: 'number', standardMin: 0, standardMax: 5, optimalMin: 0, optimalMax: 3 },
    { paramName: '耐介质试验', paramCode: 'MEDIA_TST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '低温脆性', paramCode: 'COLD_BRIT', unit: '°C', dataType: 'number', standardMin: -40, standardMax: -20, optimalMin: -38, optimalMax: -22 },
    { paramName: '高温压缩', paramCode: 'HT_COMP', unit: '°C', dataType: 'number', standardMin: 100, standardMax: 130, optimalMin: 105, optimalMax: 125 },
    { paramName: '密度', paramCode: 'DENSITY', unit: 'g/cm³', dataType: 'number', standardMin: 1.1, standardMax: 1.3, optimalMin: 1.15, optimalMax: 1.25 },
    { paramName: '结合强度', paramCode: 'BOND_STR', unit: 'N/cm', dataType: 'number', standardMin: 15, standardMax: 30, optimalMin: 20, optimalMax: 28 },
    { paramName: '表面粗糙度', paramCode: 'RA_SURF', unit: 'μm', dataType: 'number', standardMin: 0, standardMax: 3.2, optimalMin: 0, optimalMax: 1.6 },
    { paramName: '唇口完整性', paramCode: 'LIP_INT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '同心度', paramCode: 'CONCEN', unit: 'mm', dataType: 'number', standardMin: 0, standardMax: 0.15, optimalMin: 0, optimalMax: 0.08 },
    { paramName: '弹簧匹配性', paramCode: 'SPR_FIT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '老化后硬度变化', paramCode: 'AGING_HD', unit: 'IRHD', dataType: 'number', standardMin: -8, standardMax: 8, optimalMin: -5, optimalMax: 5 },
    { paramName: '批次一致性', paramCode: 'BATCH_CST', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '外观全检', paramCode: 'FULL_VIS', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '包装检查', paramCode: 'PKG_CHK', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
    { paramName: '综合判定', paramCode: 'VERDICT', unit: '', dataType: 'option', standardMin: 0, standardMax: 0, optimalMin: 0, optimalMax: 0 },
  ],
}

// 选项型参数的可选值
const OPTION_VALUES: Record<string, string[]> = {
  'WELD_Q': ['良好', '一般', '不合格'],
  'METAL': ['均匀细小', '正常', '粗大', '不合格'],
  'VISUAL': ['合格', '不合格'],
  'MT_TEST': ['无缺陷', '合格', '不合格'],
  'UT_TEST': ['无缺陷', '合格', '不合格'],
  'VERDICT': ['合格', '不合格', '待复检'],
  'THREAD_CHK': ['符合', '不符合'],
  'WEAR_TST': ['合格', '不合格'],
  'ASSY_CHK': ['合格', '不合格'],
  'SEAL_TST': ['无泄漏', '合格', '不合格'],
  'AIR_TST': ['无泄漏', '合格', '不合格'],
  'THREAD_ACC': ['6H', '6G', '不合格'],
  'SURF_TRT': ['合格', '不合格'],
  'ASSY_DIM': ['合格', '不合格'],
  'DIM_CHAIN': ['合格', '不合格'],
  'LIFE_TST': ['达标', '未达标'],
  'SPR_FAT': ['合格', '不合格'],
  'ACTION_CHK': ['灵活', '卡滞', '不合格'],
  'SEAL_FLAT': ['合格', '不合格'],
  'HYDRO_TST': ['合格', '不合格'],
  'SPR_FIT': ['匹配', '不匹配'],
  'VIB_TST': ['合格', '不合格'],
  'TEMP_TST': ['合格', '不合格'],
  'RUST_TRT': ['合格', '不合格'],
  'LIP_INT': ['完整', '缺陷', '不合格'],
  'MEDIA_TST': ['无异常', '合格', '不合格'],
  'BATCH_CST': ['一致', '不一致'],
  'PKG_CHK': ['合格', '不合格'],
  'CLEAN': ['合格', '不合格'],
}

// ============================================================
//  工具函数
// ============================================================

/** 伪随机（可复现的种子随机） */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** 生成指定范围内的数值，85%概率在标准区间内，15%在标准区间外 */
function generateValue(
  rng: () => number,
  min: number,
  max: number,
  optMin: number,
  optMax: number,
): number {
  const r = rng()
  if (r < 0.55) {
    // 55%: 最优区间内
    return optMin + rng() * (optMax - optMin)
  } else if (r < 0.85) {
    // 30%: 标准区间内但在最优区间外
    const range = max - min
    const mid = (min + max) / 2
    const halfRange = range / 2
    // 随机选左半或右半（避开最优区间中心）
    if (rng() < 0.5) {
      return min + rng() * (optMin - min)
    } else {
      return optMax + rng() * (max - optMax)
    }
  } else {
    // 15%: 超出标准区间（不合格）
    if (rng() < 0.5) {
      return min - rng() * (max - min) * 0.05
    } else {
      return max + rng() * (max - min) * 0.05
    }
  }
}

/** 生成选项型值 */
function generateOptionValue(code: string, rng: () => number): string {
  const values = OPTION_VALUES[code] ?? ['合格', '不合格']
  // 90% 合格
  if (rng() < 0.9) return values[0]
  return values[rng() < 0.5 ? 0 : 1]
}

// ============================================================
//  种子数据 API
// ============================================================

export async function POST() {
  const t0 = Date.now()

  try {
    // ── 1. 幂等清空（按外键依赖顺序） ──
    await db.inspectionDataItem.deleteMany()
    await db.inspectionRecord.deleteMany()
    await db.parameterItem.deleteMany()
    await db.parameterTemplate.deleteMany()
    await db.part.deleteMany()
    await db.meetingParticipant.deleteMany()
    await db.meeting.deleteMany()
    await db.document.deleteMany()
    await db.attendanceRecord.deleteMany()
    await db.task.deleteMany()
    await db.analysisReport.deleteMany()
    await db.equipment.deleteMany()
    await db.partCategory.deleteMany()

    const rng = seededRandom(20250601)

    // ── 2. 零件类别 ──
    const categoryDefs = [
      { name: '钻头', code: 'ZT', description: '凿岩机钻头类零部件，包含十字钻头、球齿钻头等' },
      { name: '活塞', code: 'HS', description: '凿岩机活塞组件，包含冲击活塞、配气活塞等' },
      { name: '气缸', code: 'QG', description: '凿岩机气缸组件，包含前缸体、后缸体等' },
      { name: '阀组', code: 'FZ', description: '凿岩机配气阀组，包含阀体、阀芯、弹簧等' },
      { name: '轴承', code: 'ZC', description: '凿岩机用轴承，包含滚针轴承、调心滚子轴承等' },
      { name: '密封件', code: 'MF', description: '凿岩机密封组件，包含O型圈、油封、防尘圈等' },
    ]

    const categories = await Promise.all(
      categoryDefs.map((c) =>
        db.partCategory.create({
          data: { name: c.name, code: c.code, description: c.description, standardParamCount: 40 },
        })
      )
    )

    // ── 3. 参数模板 + 参数项（每类别 40 项） ──
    const paramItemsByCategory: Record<string, string[]> = {} // categoryCode -> paramItemIds[]

    for (const cat of categories) {
      const params = CATEGORY_PARAMS[cat.code]
      if (!params || params.length !== 40) {
        return NextResponse.json({ error: `类别 ${cat.code} 参数定义数量异常: ${params?.length}` }, { status: 500 })
      }

      const template = await db.parameterTemplate.create({
        data: { name: `${cat.name}检测模板`, version: 1, categoryId: cat.id },
      })

      const items = await Promise.all(
        params.map((p, i) =>
          db.parameterItem.create({
            data: {
              templateId: template.id,
              paramName: p.paramName,
              paramCode: p.paramCode,
              unit: p.unit,
              dataType: p.dataType,
              standardMin: p.standardMin,
              standardMax: p.standardMax,
              optimalMin: p.optimalMin,
              optimalMax: p.optimalMax,
              sortOrder: i,
              options: p.dataType === 'option' ? JSON.stringify(OPTION_VALUES[p.paramCode] ?? ['合格', '不合格']) : null,
            },
          })
        )
      )

      paramItemsByCategory[cat.code] = items.map((it) => it.id)
    }

    // ── 4. 设备档案 ──
    const equipmentDefs = [
      { machineNo: 'YT28-2025-001', model: 'YT28', manufacturer: '天水凿岩机厂', productionDate: new Date('2024-06-15'), status: '在用', currentLocation: '贵州某隧道项目', totalWorkingHours: 2350 },
      { machineNo: 'HY200-2025-002', model: 'HY200', manufacturer: '阿特拉斯·科普柯', productionDate: new Date('2023-11-20'), status: '在用', currentLocation: '云南某矿山', totalWorkingHours: 4180 },
      { machineNo: 'DZ900-2025-003', model: 'DZ900', manufacturer: '山特维克', productionDate: new Date('2022-03-10'), status: '维修中', currentLocation: '维修车间', totalWorkingHours: 8560 },
    ]

    const equipmentList = await Promise.all(
      equipmentDefs.map((e) => db.equipment.create({ data: { ...e } }))
    )

    // ── 5. 零件档案 ──
    // 核心零件（12 件，手动定义，展示用）
    const partDefs = [
      // 设备 1: YT28-2025-001
      { code: 'ZT-001', name: '十字钻头-A1', categoryId: categories[0].id, specification: 'φ48mm', material: '42CrMo+YG15C', supplier: '三一供应商', equipmentId: equipmentList[0].id, status: '在用', workingHours: 1850 },
      { code: 'HS-001', name: '冲击活塞-A1', categoryId: categories[1].id, specification: 'φ120×280mm', material: '20CrMnTi渗碳', supplier: '自有生产', equipmentId: equipmentList[0].id, status: '在用', workingHours: 1650 },
      { code: 'QG-001', name: '前缸体-A1', categoryId: categories[2].id, specification: 'φ150×400mm', material: 'ZG270-500', supplier: '自有生产', equipmentId: equipmentList[0].id, status: '在用', workingHours: 2350 },
      { code: 'FZ-001', name: '配气阀组-A1', categoryId: categories[3].id, specification: 'φ60×80mm', material: '40Cr+GCr15', supplier: '中联供应商', equipmentId: equipmentList[0].id, status: '在用', workingHours: 1200 },
      // 设备 2: HY200-2025-002
      { code: 'ZT-002', name: '球齿钻头-B1', categoryId: categories[0].id, specification: 'φ64mm', material: '40CrNiMo+YG8C', supplier: '徐工供应商', equipmentId: equipmentList[1].id, status: '在用', workingHours: 3200 },
      { code: 'HS-002', name: '冲击活塞-B1', categoryId: categories[1].id, specification: 'φ135×320mm', material: '20CrMnTi渗碳', supplier: '自有生产', equipmentId: equipmentList[1].id, status: '在用', workingHours: 2980 },
      { code: 'ZC-001', name: '主轴承-B1', categoryId: categories[4].id, specification: '60×90×22mm', material: 'GCr15', supplier: '进口SKF', equipmentId: equipmentList[1].id, status: '在用', workingHours: 4180 },
      { code: 'MF-001', name: '活塞密封组-B1', categoryId: categories[5].id, specification: 'φ120×φ150mm', material: 'NBR+PU', supplier: '鼎基密封', equipmentId: equipmentList[1].id, status: '已更换', workingHours: 2800 },
      // 设备 3: DZ900-2025-003
      { code: 'QG-002', name: '后缸体-C1', categoryId: categories[2].id, specification: 'φ180×450mm', material: 'ZG270-500', supplier: '自有生产', equipmentId: equipmentList[2].id, status: '在用', workingHours: 6200 },
      { code: 'FZ-002', name: '配气阀组-C1', categoryId: categories[3].id, specification: 'φ75×95mm', material: '40Cr+GCr15', supplier: '山推供应商', equipmentId: equipmentList[2].id, status: '待检', workingHours: 5400 },
      { code: 'ZC-002', name: '前端轴承-C1', categoryId: categories[4].id, specification: '80×130×28mm', material: 'GCr15SiMn', supplier: '进口NSK', equipmentId: equipmentList[2].id, status: '在用', workingHours: 8560 },
      { code: 'MF-002', name: '缸体密封组-C1', categoryId: categories[5].id, specification: 'φ180×φ210mm', material: 'FKM', supplier: '鼎基密封', equipmentId: equipmentList[2].id, status: '报废', workingHours: 7500 },
    ]

    // 补充零件（程序化生成，使每台设备约 20 个零件，总计 60+ 个）
    const partNamesByCat: Record<string, string[]> = {
      ZT: ['十字钻头', '球齿钻头', '一字钻头', '柱齿钻头', '中心钻头', '扩孔钻头', '锥形钻头', '浅孔钻头', '深孔钻头', '潜孔钻头'],
      HS: ['冲击活塞', '配气活塞', '传动活塞', '缓冲活塞', '控制活塞', '回程活塞', '减压活塞', '增压活塞'],
      QG: ['前缸体', '后缸体', '气缸套', '导向缸体', '配气缸体', '缓冲缸体'],
      FZ: ['配气阀组', '换向阀', '调压阀', '安全阀', '止回阀', '节流阀', '排气阀'],
      ZC: ['主轴承', '前端轴承', '后端轴承', '导向轴承', '中间轴承', '推力轴承', '调心轴承', '滚针轴承'],
      MF: ['活塞密封组', '缸体密封组', '阀杆密封', '端面密封', '防尘圈', 'O型圈', '油封', '缓冲垫', '隔环', '调整垫'],
    }

    const materialsByCat: Record<string, string[]> = {
      ZT: ['42CrMo+YG15C', '40CrNiMo+YG8C', '35CrMo+YG11C', '20CrMnTi+YG6'],
      HS: ['20CrMnTi渗碳', '40Cr表面淬火', '42CrMo氮化'],
      QG: ['ZG270-500', 'HT250', 'QT450-10'],
      FZ: ['40Cr+GCr15', '20CrMnTi', '38CrMoAl'],
      ZC: ['GCr15', 'GCr15SiMn', '20Cr2Ni4A'],
      MF: ['NBR+PU', 'FKM', 'PTFE', 'HNBR'],
    }

    const suppliers = ['三一供应商', '中联供应商', '徐工供应商', '山推供应商', '自有生产', '进口SKF', '进口NSK', '鼎基密封']

    const extraParts: typeof partDefs = []
    let partCounter = 12

    // 为每台设备补充零件，使每台约 20 个
    const equipmentTargetParts = [20, 20, 20] // 每台目标零件数
    const existingCounts = [4, 4, 4] // 已有零件数

    for (let eqIdx = 0; eqIdx < 3; eqIdx++) {
      const need = equipmentTargetParts[eqIdx] - existingCounts[eqIdx]
      let added = 0
      for (const cat of categories) {
        if (added >= need) break
        const names = partNamesByCat[cat.code] ?? []
        const materials = materialsByCat[cat.code] ?? []
        // 为该类别在该设备上添加 1-2 个零件
        const addCount = Math.min(need - added, 2)
        for (let i = 0; i < addCount; i++) {
          const nameIdx = (partCounter + i) % names.length
          const matIdx = (partCounter + i) % materials.length
          const supIdx = (partCounter + i) % suppliers.length
          extraParts.push({
            code: `${cat.code}-${String(partCounter + 1).padStart(3, '0')}`,
            name: `${names[nameIdx]}-${String.fromCharCode(65 + eqIdx)}${partCounter - existingCounts[eqIdx] + i + 2}`,
            categoryId: cat.id,
            specification: `${cat.code === 'ZT' ? 'φ' + (38 + (partCounter % 5) * 8) + 'mm' : cat.code + '系列'}`,
            material: materials[matIdx],
            supplier: suppliers[supIdx],
            equipmentId: equipmentList[eqIdx].id,
            status: rng() < 0.85 ? '在用' : rng() < 0.5 ? '已更换' : '待检',
            workingHours: Math.round(500 + rng() * 5000),
          })
          added++
          partCounter++
        }
      }
    }

    const allParts = [...partDefs, ...extraParts]
    const parts = await Promise.all(
      allParts.map((p) => db.part.create({ data: { ...p, installDate: new Date('2024-07-01') } }))
    )

    // 建立 part -> categoryId -> paramItems 的查找表
    const catCodeOfPart: Record<string, string> = {}
    for (const p of parts) {
      const cat = categories.find((c) => c.id === p.categoryId)
      catCodeOfPart[p.id] = cat?.code ?? ''
    }

    // ── 6. 检测记录 + 检测数据明细（核心：4800+ 行） ──
    const inspectors = ['张伟', '李明', '王芳', '刘强', '陈静']

    // 检测计划：2 台活跃设备 × 每月 3 次 × 2 个月 = 12 条记录
    // 设备3（维修中）仅 1 次 = 1 条记录
    // 总计 13 条记录
    const inspectionPlan: Array<{
      equipmentId: string
      partsToInspect: string[] // part ids
      date: Date
      inspector: string
    }> = []

    const activeEquipParts = [
      { eqId: equipmentList[0].id, partIds: parts.filter((p) => p.equipmentId === equipmentList[0].id).map((p) => p.id) },
      { eqId: equipmentList[1].id, partIds: parts.filter((p) => p.equipmentId === equipmentList[1].id).map((p) => p.id) },
    ]
    const maintEquipParts = [
      { eqId: equipmentList[2].id, partIds: parts.filter((p) => p.equipmentId === equipmentList[2].id).map((p) => p.id) },
    ]

    // 2 个月（4月、5月），每台活跃设备每月 3 次
    for (let month = 4; month <= 5; month++) {
      const daysInMonth = month === 4 ? 30 : 31
      // 均匀分布 3 次检测
      const inspectionDays = [5, 15, 25].map((d) => Math.min(d, daysInMonth))

      for (const day of inspectionDays) {
        for (const ep of activeEquipParts) {
          inspectionPlan.push({
            equipmentId: ep.eqId,
            partsToInspect: ep.partIds,
            date: new Date(2025, month - 1, day),
            inspector: inspectors[Math.floor(rng() * inspectors.length)],
          })
        }
      }
    }
    // 设备 3 在 5 月有 1 次检测
    for (const ep of maintEquipParts) {
      inspectionPlan.push({
        equipmentId: ep.eqId,
        partsToInspect: ep.partIds,
        date: new Date(2025, 4, 10),
        inspector: '张伟',
      })
    }

    let recordIndex = 1
    let totalDataItems = 0

    for (const plan of inspectionPlan) {
      const monthStr = String(plan.date.getMonth() + 1).padStart(2, '0')
      const recordNo = `JY-2025-${String(recordIndex).padStart(4, '0')}`
      const batchNo = `PC-2025${monthStr}-${String(Math.ceil(plan.date.getDate() / 7)).padStart(2, '0')}`

      // 创建检测记录头
      const record = await db.inspectionRecord.create({
        data: {
          recordNo,
          equipmentId: plan.equipmentId,
          inspector: plan.inspector,
          batchNo,
          inspectionDate: plan.date,
          overallResult: '合格', // 后面根据明细更新
          remark: null,
        },
      })

      // 生成该记录的所有明细数据
      const dataItems: Array<{
        recordId: string
        partId: string
        paramItemId: string
        valueNumber: number | null
        valueText: string | null
        isQualified: boolean
        isOptimal: boolean
      }> = []

      let qualifiedCount = 0
      let totalParams = 0

      for (const partId of plan.partsToInspect) {
        const catCode = catCodeOfPart[partId]
        const pItemIds = paramItemsByCategory[catCode]
        if (!pItemIds) continue

        const paramDefs = CATEGORY_PARAMS[catCode] ?? []

        for (let pi = 0; pi < pItemIds.length; pi++) {
          const pItemDef = paramDefs[pi]
          const pItemId = pItemIds[pi]
          totalParams++

          if (pItemDef.dataType === 'option') {
            const textVal = generateOptionValue(pItemDef.paramCode, rng)
            const qualified = textVal === '合格' || textVal === '无缺陷' || textVal === '无泄漏' || textVal === '良好' || textVal === '达标' || textVal === '完整' || textVal === '均匀细小' || textVal === '灵活' || textVal === '匹配' || textVal === '正常' || textVal === '一致' || textVal === '6H'
            if (qualified) qualifiedCount++
            dataItems.push({
              recordId: record.id,
              partId,
              paramItemId: pItemId,
              valueNumber: null,
              valueText: textVal,
              isQualified: qualified,
              isOptimal: qualified,
            })
          } else {
            const val = generateValue(rng, pItemDef.standardMin, pItemDef.standardMax, pItemDef.optimalMin, pItemDef.optimalMax)
            const qualified = val >= pItemDef.standardMin && val <= pItemDef.standardMax
            const optimal = val >= pItemDef.optimalMin && val <= pItemDef.optimalMax
            if (qualified) qualifiedCount++
            dataItems.push({
              recordId: record.id,
              partId,
              paramItemId: pItemId,
              valueNumber: Math.round(val * 1000) / 1000, // 保留 3 位小数
              valueText: null,
              isQualified: qualified,
              isOptimal: optimal,
            })
          }
        }
      }

      // 批量写入明细（每批 500 条）
      for (let i = 0; i < dataItems.length; i += 500) {
        const batch = dataItems.slice(i, i + 500)
        await db.inspectionDataItem.createMany({ data: batch })
        totalDataItems += batch.length
      }

      // 更新记录头的整体结果
      const passRate = totalParams > 0 ? qualifiedCount / totalParams : 0
      const overallResult = passRate >= 0.95 ? '合格' : passRate >= 0.85 ? '待复检' : '不合格'
      await db.inspectionRecord.update({
        where: { id: record.id },
        data: { overallResult },
      })

      recordIndex++
    }

    // ── 7. 分析报告 ──
    await Promise.all([
      db.analysisReport.create({
        data: {
          title: '2025年4月凿岩机零部件质量分析月报',
          reportNo: 'BG-2025-04-YD001',
          type: '月度分析',
          period: '2025年4月',
          status: '已发布',
          summary: '4月份共完成12次设备检测，覆盖8台在用设备零部件，检测参数共计3840项，整体合格率91.8%。钻头类零部件合格率最高达96.2%，气缸类受前缸体内壁粗糙度波动影响，合格率偏低为87.5%。',
          conclusion: '1. 加强前缸体供应商内壁精加工工艺管控；2. 钻头类球齿钎焊质量稳定，继续保持；3. 密封件批次间一致性需关注。',
          author: '张伟',
        },
      }),
      db.analysisReport.create({
        data: {
          title: '2025年5月凿岩机零部件质量分析月报',
          reportNo: 'BG-2025-05-YD001',
          type: '月度分析',
          period: '2025年5月',
          status: '已发布',
          summary: '5月份共完成13次设备检测（含维修设备DZ900-003），检测参数4160项，整体合格率92.5%，较4月提升0.7个百分点。活塞类硬度分布趋于稳定，气缸表面质量问题较上月改善。',
          conclusion: '5月质量指标持续向好。建议关注维修设备DZ900-003各零件磨损数据，为维修方案提供数据支撑。',
          author: '张伟',
        },
      }),
      db.analysisReport.create({
        data: {
          title: '2025年Q2季度凿岩机零部件全生命周期分析报告',
          reportNo: 'BG-2025-Q2-JD001',
          type: '季度分析',
          period: '2025年Q2',
          status: '草稿',
          summary: '第二季度整体质量稳中有升。通过对YT28-001和HY200-002两台设备连续2个月检测数据跟踪，零部件寿命指标达到设计标准的1.12倍。',
          conclusion: '建议下季度重点关注：1. 高磨损件（密封件、轴承）的寿命优化；2. 活塞硬度最优区间验证；3. 新型密封材料应用对比。',
          author: '李明',
        },
      }),
      db.analysisReport.create({
        data: {
          title: '钻头类零部件专项寿命分析报告',
          reportNo: 'BG-2025-ZX-001',
          type: '专项分析',
          period: '2025年1月-6月',
          status: '已发布',
          summary: '对十字钻头ZT-001和球齿钻头ZT-002进行连续跟踪，十字钻头累计工作1850小时，球齿钻头累计工作3200小时。球齿钻头单位磨损率低于十字钻头32%。',
          conclusion: '球齿钻头性价比最优，建议高磨损工况优先选用；十字钻头在硬岩场景下寿命不足，建议升级为40CrNiMo材质+YG15C硬质合金。',
          author: '王芳',
        },
      }),
    ])

    // ── 8. 部门任务 ──
    await Promise.all([
      db.task.create({
        data: {
          title: '整理6月份检测数据台账',
          description: '汇总6月份所有零部件检测记录，核对数据完整性，确保台账与原始记录一致。',
          priority: '高',
          status: '进行中',
          taskType: '常规',
          assignee: '张伟',
          dueDate: new Date(2025, 6, 5),
        },
      }),
      db.task.create({
        data: {
          title: '编制Q2季度分析报告',
          description: '基于4-6月检测数据完成第二季度全生命周期质量分析报告，包含各零部件寿命分析。',
          priority: '高',
          status: '待办',
          taskType: '常规',
          assignee: '李明',
          dueDate: new Date(2025, 6, 10),
        },
      }),
      db.task.create({
        data: {
          title: '供应商质量数据汇总',
          description: '收集各供应商零部件检测数据，形成供应商质量对比分析表，为采购决策提供依据。',
          priority: '中',
          status: '待办',
          taskType: '领导交办',
          assignee: '王芳',
          dueDate: new Date(2025, 6, 15),
        },
      }),
      db.task.create({
        data: {
          title: '新检测标准学习培训',
          description: '组织部门人员学习最新版GB/T 6379测量方法与结果标准，形成培训记录。',
          priority: '低',
          status: '待办',
          taskType: '常规',
          assignee: '刘强',
          dueDate: new Date(2025, 6, 20),
        },
      }),
      db.task.create({
        data: {
          title: '5月份不合格品原因分析',
          description: '对5月份不合格品进行分类统计和原因分析，形成改进建议报告。',
          priority: '中',
          status: '已完成',
          taskType: '常规',
          assignee: '陈静',
          dueDate: new Date(2025, 6, 3),
        },
      }),
    ])

    const elapsed = Date.now() - t0

    return NextResponse.json({
      success: true,
      message: '种子数据创建成功',
      elapsed: `${(elapsed / 1000).toFixed(1)}s`,
      stats: {
        categories: categories.length,
        parameterTemplates: categories.length,
        parameterItems: Object.values(paramItemsByCategory).reduce((sum, ids) => sum + ids.length, 0),
        equipment: equipmentList.length,
        parts: parts.length,
        inspectionRecords: recordIndex - 1,
        inspectionDataItems: totalDataItems,
        reports: 4,
        tasks: 5,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error('[SEED ERROR]', message, error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}