/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 *
 * All polygon coordinates are NATIVE 10240×10240 space,
 * sourced directly from shattered_crown_territory_polygons_final.json.
 * No scaling is applied — polygons map 1:1 to the background PNG.
 */

import type { MapDefinition } from './types';

// Helper to convert [{x,y},...] array to SVG points string
function pts(arr: {x:number,y:number}[]): string {
  return arr.map(p => `${p.x},${p.y}`).join(' ');
}

// ─── Territory polygon data (native 10240×10240) ──────────────────────────────

const POLYS: Record<string, {x:number,y:number}[]> = {
  B1: [{x:4493.33,y:3946.67},{x:5464.0,y:3912.0},{x:5745.78,y:3579.56},{x:5154.67,y:3394.67},{x:4663.11,y:3605.33},{x:4664.89,y:3762.67}],
  B2: [{x:5842.67,y:4553.33},{x:4628.44,y:4348.44},{x:4600.89,y:4260.44},{x:4533.33,y:4202.67},{x:4493.33,y:4128.89},{x:4493.33,y:3946.67},{x:5464.0,y:3912.0},{x:5948.0,y:4173.33}],
  B3: [{x:5948.0,y:4173.33},{x:5464.0,y:3912.0},{x:5745.78,y:3579.56},{x:5926.7,y:3467.24},{x:6080.89,y:3624.0},{x:6160.0,y:3624.0},{x:6213.33,y:3715.56},{x:6410.67,y:3736.89},{x:6490.67,y:3815.11},{x:6554.67,y:3928.89},{x:6656.0,y:4008.0}],
  B4: [{x:6597.33,y:4648.89},{x:5842.67,y:4553.33},{x:5948.0,y:4173.33},{x:6656.0,y:4008.0},{x:6732.44,y:4213.33},{x:6789.33,y:4312.89},{x:6729.78,y:4500.44}],
  B5: [{x:5074.67,y:4912.0},{x:4621.33,y:4766.22},{x:4453.33,y:4576.89},{x:4504.89,y:4398.22},{x:4628.44,y:4348.44},{x:5238.12,y:4451.32}],
  B6: [{x:5817.33,y:5000.0},{x:5074.67,y:4912.0},{x:5238.12,y:4451.32},{x:5842.67,y:4553.33}],
  B7: [{x:6391.11,y:5101.33},{x:5817.33,y:5000.0},{x:5842.67,y:4553.33},{x:6597.33,y:4648.89},{x:6484.44,y:4850.67}],
  B8: [{x:5277.64,y:4936.05},{x:5149.33,y:5418.67},{x:4877.33,y:5395.56},{x:4746.67,y:5399.11},{x:4611.56,y:5360.89},{x:4553.78,y:5263.11},{x:4514.67,y:4994.67},{x:4548.44,y:4808.89},{x:4621.33,y:4766.22},{x:5074.67,y:4912.0}],
  B9: [{x:5817.33,y:5000.0},{x:5747.56,y:5364.44},{x:5614.22,y:5456.0},{x:5514.67,y:5494.22},{x:5336.89,y:5443.56},{x:5149.33,y:5418.67},{x:5277.64,y:4936.05}],
  B10:[{x:6391.11,y:5101.33},{x:6465.78,y:5317.33},{x:6350.22,y:5424.89},{x:6416.89,y:5534.22},{x:6420.44,y:5601.78},{x:6268.44,y:5629.33},{x:6203.56,y:5601.78},{x:6051.56,y:5604.44},{x:5968.89,y:5550.22},{x:5960.89,y:5506.67},{x:5884.44,y:5494.22},{x:5747.56,y:5364.44},{x:5817.33,y:5000.0}],

  // Shattered Coast — C1/C2/C3/C4/C5/C7/C8 use delta/relative coords in source JSON.
  // Accumulated here to absolute coords by summing deltas from the first anchor point.
  // C6 is fully absolute in the source.
  C1: [{x:6841.78,y:2936.0},{x:6843.62,y:2926.83},{x:6848.47,y:2902.63},{x:6855.37,y:2868.36},{x:6863.34,y:2829.0},{x:6871.38,y:2789.52},{x:6878.53,y:2754.88},{x:6883.8,y:2730.05},{x:6886.22,y:2720.0},{x:6890.51,y:2716.45},{x:6900.72,y:2708.73},{x:6914.85,y:2698.3},{x:6930.89,y:2686.55},{x:6946.85,y:2674.94},{x:6960.72,y:2664.87},{x:6970.51,y:2657.79},{x:6974.22,y:2655.11},{x:6975.88,y:2654.62},{x:6980.34,y:2653.21},{x:6986.83,y:2650.94},{x:6994.55,y:2647.89},{x:7002.73,y:2644.13},{x:7010.59,y:2639.73},{x:7017.35,y:2634.78},{x:7022.22,y:2629.33},{x:7026.78,y:2620.48},{x:7032.73,y:2606.57},{x:7039.46,y:2589.5},{x:7046.33,y:2571.22},{x:7052.75,y:2553.64},{x:7058.1,y:2538.7},{x:7061.75,y:2528.33},{x:7063.11,y:2524.44},{x:7192.89,y:2464.0},{x:7228.45,y:2288.0},{x:7272.89,y:2288.0},{x:7284.45,y:2465.78},{x:7338.67,y:2522.67},{x:7351.11,y:2584.0},{x:7453.33,y:2641.78},{x:7470.22,y:2712.89},{x:7472.75,y:2712.32},{x:7479.43,y:2710.86},{x:7488.92,y:2708.86},{x:7499.89,y:2706.67},{x:7510.98,y:2704.64},{x:7520.84,y:2703.14},{x:7528.15,y:2702.51},{x:7531.55,y:2703.11},{x:7536.9,y:2705.92},{x:7549.34,y:2711.14},{x:7566.47,y:2717.89},{x:7585.88,y:2725.33},{x:7605.17,y:2732.61},{x:7621.93,y:2738.86},{x:7633.75,y:2743.24},{x:7638.22,y:2744.89},{x:7583.11,y:2812.45},{x:7535.11,y:2849.78},{x:7590.22,y:2912.0},{x:7560.0,y:2988.44},{x:7465.78,y:3040.88},{x:7363.56,y:3100.44},{x:7299.56,y:3139.55},{x:7210.67,y:3132.44},{x:7158.23,y:3179.55},{x:7213.34,y:3237.33},{x:7169.78,y:3270.22},{x:7081.78,y:3274.66},{x:7032.89,y:3311.99},{x:6979.56,y:3299.55},{x:6960.0,y:3264.88},{x:7002.67,y:3160.88},{x:6841.78,y:2935.99}],
  C2: [{x:7264.0,y:3230.22},{x:7277.58,y:3220.42},{x:7303.99,y:3203.98},{x:7338.7,y:3183.36},{x:7377.22,y:3161.0},{x:7415.03,y:3139.34},{x:7447.62,y:3120.85},{x:7470.49,y:3107.95},{x:7479.11,y:3103.11},{x:7651.55,y:3199.11},{x:7733.33,y:3376.0},{x:7737.09,y:3376.66},{x:7747.04,y:3378.25},{x:7761.22,y:3380.22},{x:7777.66,y:3382.0},{x:7794.4,y:3383.03},{x:7809.45,y:3382.75},{x:7820.86,y:3380.59},{x:7826.66,y:3376.0},{x:7830.43,y:3364.99},{x:7836.51,y:3345.92},{x:7844.02,y:3321.72},{x:7852.1,y:3295.33},{x:7859.9,y:3269.7},{x:7866.53,y:3247.75},{x:7871.15,y:3232.43},{x:7872.88,y:3226.67},{x:7935.1,y:3193.78},{x:7978.66,y:3280.0},{x:8011.55,y:3418.67},{x:7919.99,y:3473.78},{x:7925.32,y:3632.89},{x:7841.76,y:3654.22},{x:7587.54,y:3654.22},{x:7507.54,y:3715.55},{x:7290.65,y:3586.66},{x:7130.65,y:3648.88},{x:7125.46,y:3646.5},{x:7111.77,y:3640.14},{x:7092.45,y:3631.02},{x:7070.32,y:3620.32},{x:7048.23,y:3609.25},{x:7029.02,y:3599.01},{x:7015.55,y:3590.78},{x:7010.65,y:3585.77},{x:7009.0,y:3577.82},{x:7004.08,y:3561.84},{x:6996.98,y:3540.63},{x:6988.76,y:3516.99},{x:6980.51,y:3493.73},{x:6973.28,y:3473.64},{x:6968.16,y:3459.53},{x:6966.21,y:3454.21},{x:7079.99,y:3336.88},{x:7151.99,y:3324.44},{x:7204.43,y:3368.0},{x:7207.11,y:3366.75},{x:7214.21,y:3363.36},{x:7224.3,y:3358.34},{x:7235.98,y:3352.22},{x:7247.83,y:3345.52},{x:7258.43,y:3338.75},{x:7266.36,y:3332.44},{x:7270.21,y:3327.11},{x:7270.96,y:3319.38},{x:7270.74,y:3306.72},{x:7269.81,y:3290.99},{x:7268.43,y:3274.0},{x:7266.9,y:3257.6},{x:7265.46,y:3243.61},{x:7264.4,y:3233.87},{x:7263.99,y:3230.22}],
  C3: [{x:7230.22,y:3980.44},{x:7233.71,y:3974.51},{x:7240.16,y:3965.48},{x:7248.53,y:3954.52},{x:7257.78,y:3942.77},{x:7266.85,y:3931.4},{x:7274.72,y:3921.56},{x:7280.34,y:3914.42},{x:7282.66,y:3911.11},{x:7283.45,y:3904.35},{x:7284.98,y:3888.18},{x:7286.98,y:3865.78},{x:7289.21,y:3840.33},{x:7291.4,y:3815.01},{x:7293.28,y:3792.98},{x:7294.6,y:3777.44},{x:7295.1,y:3771.55},{x:7300.16,y:3770.69},{x:7313.59,y:3768.52},{x:7332.74,y:3765.64},{x:7354.99,y:3762.66},{x:7377.69,y:3760.18},{x:7398.22,y:3758.8},{x:7413.94,y:3759.13},{x:7422.21,y:3761.77},{x:7427.65,y:3768.54},{x:7435.92,y:3779.74},{x:7445.91,y:3793.74},{x:7456.54,y:3808.88},{x:7466.71,y:3823.52},{x:7475.33,y:3836.02},{x:7481.31,y:3844.72},{x:7483.54,y:3847.99},{x:7485.22,y:3845.0},{x:7489.64,y:3837.09},{x:7495.87,y:3825.82},{x:7502.98,y:3812.77},{x:7510.06,y:3799.51},{x:7516.16,y:3787.62},{x:7520.37,y:3778.66},{x:7521.76,y:3774.21},{x:7520.89,y:3770.41},{x:7519.16,y:3763.17},{x:7516.87,y:3753.69},{x:7514.32,y:3743.21},{x:7511.8,y:3732.93},{x:7509.64,y:3724.08},{x:7508.11,y:3717.88},{x:7507.54,y:3715.54},{x:7587.54,y:3654.21},{x:7841.76,y:3654.21},{x:7925.32,y:3632.88},{x:7927.0,y:3632.65},{x:7931.43,y:3632.01},{x:7937.69,y:3631.05},{x:7944.87,y:3629.88},{x:7952.06,y:3628.58},{x:7958.32,y:3627.26},{x:7962.75,y:3625.99},{x:7964.43,y:3624.88},{x:7964.85,y:3621.01},{x:7965.99,y:3612.46},{x:7967.62,y:3600.78},{x:7969.54,y:3587.54},{x:7971.55,y:3574.31},{x:7973.43,y:3562.63},{x:7974.98,y:3554.08},{x:7975.99,y:3550.21},{x:7977.34,y:3548.79},{x:7979.8,y:3546.72},{x:7982.96,y:3544.26},{x:7986.44,y:3541.65},{x:7989.83,y:3539.18},{x:7992.74,y:3537.09},{x:7994.78,y:3535.64},{x:7995.55,y:3535.1},{x:8023.11,y:3569.77},{x:8026.67,y:3630.21},{x:8128.0,y:3715.54},{x:8176.89,y:3893.32},{x:8138.67,y:3956.43},{x:8084.45,y:4023.1},{x:8132.45,y:4104.88},{x:8203.56,y:4071.1},{x:8252.45,y:4121.77},{x:8250.27,y:4123.83},{x:8244.49,y:4129.28},{x:8236.28,y:4137.0},{x:8226.78,y:4145.88},{x:8217.16,y:4154.8},{x:8208.58,y:4162.65},{x:8202.18,y:4168.3},{x:8199.12,y:4170.66},{x:8198.09,y:4172.63},{x:8197.02,y:4177.29},{x:8195.98,y:4183.71},{x:8195.01,y:4190.99},{x:8194.16,y:4198.24},{x:8193.5,y:4204.54},{x:8193.06,y:4208.98},{x:8192.9,y:4210.66},{x:8248.9,y:4270.22},{x:8247.1,y:4272.74},{x:8242.32,y:4279.4},{x:8235.49,y:4288.83},{x:8227.57,y:4299.67},{x:8219.47,y:4310.54},{x:8212.15,y:4320.1},{x:8206.54,y:4326.97},{x:8203.57,y:4329.78},{x:8197.66,y:4331.6},{x:8184.29,y:4335.85},{x:8166.01,y:4341.7},{x:8145.35,y:4348.33},{x:8124.85,y:4354.92},{x:8107.07,y:4360.65},{x:8094.53,y:4364.69},{x:8089.79,y:4366.22},{x:7997.35,y:4366.22},{x:7895.13,y:4305.78},{x:7768.02,y:4236.45},{x:7714.69,y:4223.12},{x:7776.91,y:4338.68},{x:7901.35,y:4421.35},{x:7865.79,y:4512.02},{x:7686.23,y:4559.13},{x:7682.6,y:4558.01},{x:7673.05,y:4555.02},{x:7659.56,y:4550.69},{x:7644.12,y:4545.57},{x:7628.72,y:4540.21},{x:7615.36,y:4535.13},{x:7606.01,y:4530.89},{x:7602.67,y:4528.02},{x:7600.71,y:4518.55},{x:7594.99,y:4496.88},{x:7586.74,y:4467.18},{x:7577.22,y:4433.58},{x:7567.66,y:4400.22},{x:7559.29,y:4371.27},{x:7553.36,y:4350.86},{x:7551.11,y:4343.13},{x:7422.22,y:4173.35},{x:7230.22,y:3980.46}],
  C4: [{x:7028.44,y:4997.33},{x:7040.13,y:4989.69},{x:7065.97,y:4975.51},{x:7101.1,y:4956.94},{x:7140.66,y:4936.11},{x:7179.81,y:4915.15},{x:7213.69,y:4896.21},{x:7237.45,y:4881.41},{x:7246.22,y:4872.89},{x:7243.07,y:4863.89},{x:7235.36,y:4847.86},{x:7224.69,y:4827.3},{x:7212.66,y:4804.67},{x:7200.89,y:4782.46},{x:7190.97,y:4763.14},{x:7184.51,y:4749.2},{x:7183.11,y:4743.11},{x:7185.65,y:4741.32},{x:7189.57,y:4738.83},{x:7194.34,y:4735.92},{x:7199.44,y:4732.89},{x:7204.33,y:4730.02},{x:7208.48,y:4727.61},{x:7211.36,y:4725.95},{x:7212.44,y:4725.33},{x:7288.88,y:4764.44},{x:7351.1,y:4725.33},{x:7252.43,y:4665.77},{x:7306.65,y:4637.33},{x:7398.21,y:4675.55},{x:7493.32,y:4559.11},{x:7447.1,y:4429.33},{x:7444.46,y:4423.56},{x:7437.5,y:4408.32},{x:7427.65,y:4386.72},{x:7416.32,y:4361.89},{x:7404.96,y:4336.93},{x:7394.98,y:4314.96},{x:7387.81,y:4299.09},{x:7384.88,y:4292.44},{x:7381.61,y:4289.99},{x:7373.52,y:4285.16},{x:7362.22,y:4278.75},{x:7349.32,y:4271.55},{x:7336.43,y:4264.35},{x:7325.13,y:4257.94},{x:7317.04,y:4253.11},{x:7313.77,y:4250.66},{x:7311.49,y:4244.43},{x:7306.03,y:4229.67},{x:7298.47,y:4209.27},{x:7289.88,y:4186.1},{x:7281.33,y:4163.06},{x:7273.9,y:4143.04},{x:7268.65,y:4128.9},{x:7266.66,y:4123.55},{x:7160.88,y:4199.11},{x:7111.1,y:4153.78},{x:7028.43,y:4037.34},{x:6946.65,y:4146.67},{x:6989.32,y:4275.56},{x:6918.21,y:4353.78},{x:6952.88,y:4528.0},{x:6996.44,y:4685.33},{x:6943.11,y:4717.33},{x:6907.55,y:4783.11},{x:6913.77,y:4933.33}],
  C5: [{x:7236.44,y:5064.89},{x:7237.6,y:5059.36},{x:7240.7,y:5044.81},{x:7245.21,y:5024.3},{x:7250.55,y:5000.89},{x:7256.19,y:4977.65},{x:7261.57,y:4957.64},{x:7266.13,y:4943.92},{x:7269.33,y:4939.56},{x:7274.71,y:4941.88},{x:7285.01,y:4945.78},{x:7298.5,y:4950.69},{x:7313.44,y:4956.01},{x:7328.09,y:4961.16},{x:7340.71,y:4965.56},{x:7349.55,y:4968.63},{x:7352.89,y:4969.78},{x:7355.64,y:4967.2},{x:7362.89,y:4960.29},{x:7373.14,y:4950.33},{x:7384.89,y:4938.56},{x:7396.64,y:4926.25},{x:7406.89,y:4914.65},{x:7414.14,y:4905.04},{x:7416.89,y:4898.67},{x:7420.17,y:4887.6},{x:7428.83,y:4865.6},{x:7441.08,y:4836.5},{x:7455.11,y:4804.12},{x:7469.14,y:4772.28},{x:7481.39,y:4744.8},{x:7490.05,y:4725.51},{x:7493.33,y:4718.23},{x:7672.0,y:4759.12},{x:7864.89,y:4942.23},{x:8036.45,y:5084.45},{x:8218.67,y:5208.01},{x:8064.89,y:5320.9},{x:7888.89,y:5475.57},{x:7786.67,y:5574.24},{x:7720.0,y:5553.8},{x:7576.0,y:5392.91},{x:7399.11,y:5209.8},{x:7236.44,y:5064.91}],
  C6: [{x:6660.44,y:5461.33},{x:6830.22,y:5158.22},{x:6850.67,y:5078.22},{x:7009.78,y:5175.11},{x:7065.78,y:5081.78},{x:7167.11,y:5223.11},{x:7385.78,y:5417.78},{x:7327.11,y:5527.11},{x:7369.78,y:5629.33},{x:7225.78,y:5691.56},{x:7106.67,y:5805.33},{x:6832.0,y:5638.22}],
  C7: [{x:7138.67,y:6494.22},{x:7127.16,y:6479.71},{x:7099.58,y:6450.3},{x:7061.34,y:6411.19},{x:7017.89,y:6367.55},{x:6974.65,y:6324.58},{x:6937.05,y:6287.47},{x:6910.5,y:6261.39},{x:6900.45,y:6251.55},{x:6905.78,y:6135.99},{x:6977.78,y:6053.32},{x:6991.11,y:5954.65},{x:7031.11,y:5967.98},{x:7034.67,y:6031.09},{x:7189.34,y:6036.42},{x:7207.12,y:5965.31},{x:7284.45,y:5986.64},{x:7284.45,y:6063.97},{x:7474.67,y:6228.41},{x:7491.56,y:6359.08},{x:7381.34,y:6456.86},{x:7138.67,y:6494.19}],
  C8: [{x:7428.44,y:5920.89},{x:7430.47,y:5906.71},{x:7434.15,y:5879.28},{x:7438.89,y:5843.27},{x:7444.11,y:5803.34},{x:7449.19,y:5764.15},{x:7453.56,y:5730.39},{x:7456.62,y:5706.71},{x:7457.77,y:5697.78},{x:7624.88,y:5493.34},{x:7716.44,y:5629.34},{x:7861.33,y:5612.45},{x:7984.89,y:5841.78},{x:7946.67,y:6035.56},{x:7695.11,y:6080.89},{x:7580.44,y:6058.67}],

  I1: [{x:4207.11,y:2246.22},{x:4410.67,y:2883.11},{x:4132.44,y:3121.78},{x:3768.0,y:2893.33},{x:3596.44,y:2743.11},{x:3696.0,y:2475.56},{x:3806.22,y:2491.56},{x:3902.22,y:2482.67},{x:4079.11,y:2372.44}],
  I2: [{x:5041.78,y:2314.67},{x:4942.67,y:2898.67},{x:4410.67,y:2883.11},{x:4207.11,y:2246.22},{x:4289.78,y:2296.0},{x:4349.33,y:2282.67},{x:4472.89,y:2173.33},{x:4571.56,y:2253.33},{x:4663.11,y:2248.0},{x:4743.11,y:2170.67},{x:4895.11,y:2322.67},{x:4986.67,y:2268.44}],
  I3: [{x:5854.22,y:2420.44},{x:5389.33,y:2957.33},{x:4942.67,y:2898.67},{x:5041.78,y:2314.67},{x:5120.0,y:2302.22},{x:5309.33,y:2160.89},{x:5455.11,y:2248.89},{x:5506.67,y:2231.11},{x:5660.44,y:2384.89},{x:5742.22,y:2298.67}],
  I4: [{x:6378.67,y:2860.44},{x:6103.11,y:3061.33},{x:5389.33,y:2957.33},{x:5854.22,y:2420.44},{x:5978.67,y:2475.56},{x:6105.78,y:2568.89},{x:6248.0,y:2591.11},{x:6288.0,y:2662.22},{x:6336.0,y:2673.78}],
  I5: [{x:4132.44,y:3121.78},{x:4410.67,y:2883.11},{x:4942.67,y:2898.67},{x:4663.11,y:3605.33},{x:4531.56,y:3484.44},{x:4422.22,y:3500.44},{x:4098.67,y:3240.89}],
  I6: [{x:4942.67,y:2898.67},{x:5389.33,y:2957.33},{x:5353.03,y:3456.71},{x:5154.67,y:3394.67},{x:4663.11,y:3605.33}],
  I7: [{x:6077.33,y:3163.56},{x:6139.56,y:3335.11},{x:5745.78,y:3579.56},{x:5353.03,y:3456.71},{x:5389.33,y:2957.33},{x:6103.11,y:3061.33}],
  I8: [{x:6309.33,y:3269.33},{x:6103.11,y:3061.33},{x:6378.67,y:2860.44},{x:6415.11,y:2879.11},{x:6467.56,y:2814.22},{x:6566.22,y:2985.78},{x:6640.0,y:2970.67},{x:6660.44,y:2890.67},{x:6702.22,y:2946.67},{x:6733.33,y:3050.67},{x:6821.33,y:3112.89},{x:6799.11,y:3155.56},{x:6821.33,y:3242.67},{x:6656.0,y:3293.33},{x:6532.44,y:3201.78},{x:6442.67,y:3281.78}],

  S1: [{x:3857.78,y:5586.67},{x:4161.78,y:5859.56},{x:4096.0,y:6076.44},{x:2858.67,y:6170.67},{x:2897.78,y:6100.44},{x:2828.44,y:6008.89},{x:2771.56,y:5985.78},{x:2800.0,y:5954.67},{x:2787.56,y:5896.0},{x:2739.56,y:5870.22},{x:2858.67,y:5748.44},{x:2943.11,y:5689.78},{x:3196.44,y:5454.22},{x:3414.22,y:5477.33},{x:3503.11,y:5558.22}],
  S2: [{x:5342.03,y:5523.26},{x:5277.64,y:6113.78},{x:4096.0,y:6076.44},{x:4161.78,y:5859.56},{x:3857.78,y:5586.67},{x:4231.11,y:5411.56},{x:4491.56,y:5344.89},{x:4660.44,y:5429.33},{x:4996.44,y:5441.78},{x:5104.0,y:5491.56}],
  S3: [{x:6439.11,y:5995.56},{x:5277.64,y:6113.78},{x:5342.03,y:5523.26},{x:5511.11,y:5545.78},{x:5762.67,y:5506.67},{x:5866.67,y:5542.22},{x:5844.44,y:5593.78},{x:5926.22,y:5665.78},{x:6045.33,y:5670.22},{x:6121.78,y:5665.78},{x:6269.33,y:5717.33},{x:6185.78,y:5775.11},{x:6231.11,y:5856.89},{x:6402.67,y:5912.89}],
  S4: [{x:4147.56,y:6519.11},{x:3241.78,y:6979.56},{x:3129.78,y:6946.67},{x:3042.67,y:7014.22},{x:2896.0,y:7023.11},{x:2840.0,y:6925.33},{x:2930.67,y:6823.11},{x:2985.78,y:6848.89},{x:3067.56,y:6764.44},{x:2957.33,y:6626.67},{x:2801.78,y:6542.22},{x:2714.67,y:6408.89},{x:2714.67,y:6179.56},{x:2858.67,y:6170.67},{x:4096.0,y:6076.44}],
  S5: [{x:4147.56,y:6519.11},{x:4096.0,y:6076.44},{x:5277.64,y:6113.78},{x:5822.22,y:6866.67},{x:4471.11,y:6785.78}],
  S6: [{x:5822.22,y:6866.67},{x:5277.64,y:6113.78},{x:6439.11,y:5995.56},{x:6558.22,y:6043.56},{x:6644.44,y:6048.0},{x:6717.33,y:6115.56},{x:6677.33,y:6190.22},{x:6740.44,y:6266.67},{x:6716.44,y:6290.67},{x:6661.33,y:6286.22},{x:6651.56,y:6345.78},{x:6553.78,y:6345.78},{x:6484.44,y:6373.33},{x:6468.44,y:6553.78},{x:6266.67,y:6620.44},{x:6173.33,y:6601.78},{x:6008.0,y:6643.56},{x:6093.33,y:6692.44},{x:5999.11,y:6802.67},{x:5900.44,y:6854.22}],
  S7: [{x:4471.11,y:6785.78},{x:4393.78,y:7149.33},{x:4215.11,y:7128.0},{x:3989.33,y:7222.22},{x:3909.33,y:7209.78},{x:3793.78,y:7107.56},{x:3656.89,y:7107.56},{x:3609.78,y:7196.44},{x:3523.56,y:7191.11},{x:3373.33,y:7120.0},{x:3250.67,y:7030.22},{x:3241.78,y:6979.56},{x:4147.56,y:6519.11}],
  S8: [{x:4471.11,y:6785.78},{x:5822.22,y:6866.67},{x:5895.11,y:6954.67},{x:5887.11,y:7075.56},{x:5627.56,y:7203.56},{x:5374.22,y:7082.67},{x:5149.33,y:7198.22},{x:5109.33,y:7283.56},{x:4899.56,y:7304.89},{x:4790.22,y:7238.22},{x:4663.11,y:7292.44},{x:4393.78,y:7149.33}],
  S9: [{x:6266.67,y:6620.44},{x:6468.44,y:6553.78},{x:6518.22,y:6606.22},{x:6665.78,y:6592.0},{x:6860.44,y:6594.67},{x:7050.67,y:6680.89},{x:7206.22,y:6799.11},{x:7206.22,y:6848.89},{x:7188.44,y:6914.67},{x:7200.89,y:6979.56},{x:7225.78,y:7028.44},{x:7024.89,y:7144.0},{x:6958.22,y:7227.56},{x:6870.22,y:7231.11},{x:6832.0,y:7283.56},{x:6744.0,y:7278.22},{x:6645.33,y:7277.33},{x:6515.56,y:7160.0},{x:6367.11,y:7060.44},{x:6197.33,y:6906.67},{x:6103.11,y:6869.33},{x:6152.0,y:6766.22}],

  W1: [{x:3758.22,y:3064.0},{x:3397.33,y:3388.0},{x:2741.33,y:3541.33},{x:2701.33,y:3403.56},{x:2821.33,y:3140.44},{x:2877.33,y:3092.44},{x:2880.89,y:2928.89},{x:2908.44,y:2922.67},{x:2935.11,y:2947.56},{x:2938.67,y:2873.78},{x:2971.56,y:2831.11},{x:3115.56,y:2895.11},{x:3190.22,y:2842.67},{x:3190.34,y:2736.0},{x:3246.22,y:2779.56},{x:3261.33,y:2765.33},{x:3272.89,y:2696.0},{x:3250.67,y:2656.89},{x:3281.78,y:2608.89},{x:3349.33,y:2659.56},{x:3344.89,y:2707.56},{x:3370.67,y:2760.89},{x:3432.89,y:2722.67},{x:3553.78,y:2834.67},{x:3566.22,y:2890.67},{x:3544.0,y:2920.89},{x:3704.89,y:3014.22},{x:3744.89,y:3003.56}],
  W2: [{x:3456.0,y:3974.67},{x:3197.33,y:3852.0},{x:2768.0,y:3778.67},{x:2775.11,y:3695.11},{x:2739.56,y:3646.22},{x:2741.33,y:3541.33},{x:3397.33,y:3388.0},{x:3758.22,y:3064.0},{x:3905.78,y:3108.44},{x:3920.0,y:3080.89},{x:4004.44,y:3086.22},{x:4052.44,y:3148.44},{x:4048.0,y:3231.11},{x:4008.89,y:3289.78},{x:4020.44,y:3319.11},{x:4083.56,y:3309.33},{x:4125.33,y:3351.11},{x:4110.22,y:3374.22},{x:4112.89,y:3409.78}],
  W3: [{x:4414.22,y:4176.89},{x:3456.0,y:3974.67},{x:4112.89,y:3409.78},{x:4317.33,y:3557.33},{x:4408.0,y:3557.33},{x:4485.33,y:3578.67},{x:4549.33,y:3670.22},{x:4552.89,y:3736.89},{x:4416.89,y:3874.67},{x:4376.0,y:3983.11},{x:4461.33,y:4040.0},{x:4461.33,y:4082.67}],
  W4: [{x:3197.33,y:3852.0},{x:2697.33,y:4945.33},{x:2248.89,y:4889.78},{x:2215.11,y:4843.56},{x:2064.0,y:4730.67},{x:2088.0,y:4624.89},{x:2152.89,y:4538.67},{x:2111.11,y:4441.78},{x:2171.56,y:4333.33},{x:2312.89,y:4301.33},{x:2321.78,y:4205.33},{x:2280.89,y:4120.89},{x:2268.44,y:4043.56},{x:2350.22,y:3984.0},{x:2347.56,y:3900.44},{x:2407.11,y:3924.44},{x:2460.44,y:3853.33},{x:2488.89,y:3909.33},{x:2564.44,y:3880.0},{x:2584.0,y:3801.78},{x:2663.11,y:3661.33},{x:2768.0,y:3778.67}],
  W5: [{x:3776.0,y:4936.05},{x:2697.33,y:4945.33},{x:3197.33,y:3852.0},{x:3456.0,y:3974.67},{x:3877.15,y:4063.55}],
  W6: [{x:4369.78,y:4998.22},{x:3776.0,y:4936.05},{x:3877.15,y:4063.55},{x:4414.22,y:4176.89},{x:4498.67,y:4233.78},{x:4512.0,y:4313.78},{x:4474.67,y:4424.89},{x:4392.89,y:4492.44},{x:4400.89,y:4617.78},{x:4464.0,y:4696.89},{x:4453.33,y:4794.67},{x:4425.78,y:4880.89},{x:4361.78,y:4943.11}],
  W7: [{x:2930.68,y:4943.33},{x:3196.44,y:5454.22},{x:2943.11,y:5689.78},{x:2874.67,y:5648.89},{x:2681.78,y:5762.67},{x:2490.67,y:5827.56},{x:2392.0,y:5790.22},{x:2294.22,y:5690.67},{x:2344.89,y:5577.78},{x:1999.11,y:5242.67},{x:1999.11,y:5106.67},{x:2248.89,y:4889.78},{x:2697.33,y:4945.33}],
  W8: [{x:3776.0,y:4936.05},{x:3816.89,y:5515.56},{x:3586.67,y:5503.11},{x:3398.22,y:5427.56},{x:3196.44,y:5454.22},{x:2930.68,y:4943.33}],
  W9: [{x:3776.0,y:4936.05},{x:4369.78,y:4998.22},{x:4444.44,y:5034.67},{x:4410.67,y:5135.11},{x:4453.33,y:5185.78},{x:4491.56,y:5344.89},{x:4231.11,y:5411.56},{x:4084.44,y:5372.44},{x:3816.89,y:5515.56}],
};

// Compute centroid of a polygon
function centroid(poly: {x:number,y:number}[]): {cx:number,cy:number} {
  const cx = poly.reduce((s,p)=>s+p.x,0)/poly.length;
  const cy = poly.reduce((s,p)=>s+p.y,0)/poly.length;
  return {cx:+cx.toFixed(1), cy:+cy.toFixed(1)};
}

// ─── Per-territory label and troop anchor overrides ──────────────────────────
// label_x/label_y: where the name text should appear
// troop_x/troop_y: where the troop count badge should appear

const ANCHORS: Record<string, { label_x:number, label_y:number, troop_x:number, troop_y:number }> = {
  B1:  { label_x:4970,  label_y:3700,  troop_x:5050,  troop_y:3820  },
  B2:  { label_x:5100,  label_y:4180,  troop_x:5150,  troop_y:4310  },
  B3:  { label_x:5900,  label_y:3760,  troop_x:5980,  troop_y:3900  },
  B4:  { label_x:6280,  label_y:4300,  troop_x:6340,  troop_y:4450  },
  B5:  { label_x:4780,  label_y:4640,  troop_x:4850,  troop_y:4780  },
  B6:  { label_x:5380,  label_y:4720,  troop_x:5420,  troop_y:4860  },
  B7:  { label_x:6100,  label_y:4800,  troop_x:6160,  troop_y:4950  },
  B8:  { label_x:4870,  label_y:5100,  troop_x:4900,  troop_y:5250  },
  B9:  { label_x:5430,  label_y:5220,  troop_x:5470,  troop_y:5350  },
  B10: { label_x:6080,  label_y:5330,  troop_x:6100,  troop_y:5490  },
  C1:  { label_x:7100,  label_y:2820,  troop_x:7080,  troop_y:2960  },
  C2:  { label_x:7540,  label_y:3430,  troop_x:7560,  troop_y:3570  },
  C3:  { label_x:7840,  label_y:4050,  troop_x:7860,  troop_y:4200  },
  C4:  { label_x:7060,  label_y:4650,  troop_x:7070,  troop_y:4800  },
  C5:  { label_x:7620,  label_y:5000,  troop_x:7640,  troop_y:5140  },
  C6:  { label_x:7000,  label_y:5450,  troop_x:7010,  troop_y:5580  },
  C7:  { label_x:7180,  label_y:6200,  troop_x:7190,  troop_y:6340  },
  C8:  { label_x:7720,  label_y:5830,  troop_x:7740,  troop_y:5960  },
  I1:  { label_x:3950,  label_y:2620,  troop_x:4000,  troop_y:2760  },
  I2:  { label_x:4540,  label_y:2620,  troop_x:4580,  troop_y:2760  },
  I3:  { label_x:5320,  label_y:2620,  troop_x:5360,  troop_y:2760  },
  I4:  { label_x:5950,  label_y:2700,  troop_x:5980,  troop_y:2840  },
  I5:  { label_x:4400,  label_y:3250,  troop_x:4440,  troop_y:3390  },
  I6:  { label_x:5060,  label_y:3170,  troop_x:5090,  troop_y:3310  },
  I7:  { label_x:5700,  label_y:3250,  troop_x:5730,  troop_y:3390  },
  I8:  { label_x:6500,  label_y:3150,  troop_x:6520,  troop_y:3290  },
  S1:  { label_x:3100,  label_y:5780,  troop_x:3130,  troop_y:5920  },
  S2:  { label_x:4400,  label_y:5800,  troop_x:4430,  troop_y:5940  },
  S3:  { label_x:5700,  label_y:5750,  troop_x:5730,  troop_y:5880  },
  S4:  { label_x:3100,  label_y:6560,  troop_x:3130,  troop_y:6700  },
  S5:  { label_x:4700,  label_y:6420,  troop_x:4730,  troop_y:6560  },
  S6:  { label_x:6000,  label_y:6380,  troop_x:6030,  troop_y:6520  },
  S7:  { label_x:3900,  label_y:7000,  troop_x:3930,  troop_y:7130  },
  S8:  { label_x:5200,  label_y:7030,  troop_x:5230,  troop_y:7160  },
  S9:  { label_x:6700,  label_y:6980,  troop_x:6730,  troop_y:7110  },
  W1:  { label_x:3250,  label_y:3050,  troop_x:3280,  troop_y:3190  },
  W2:  { label_x:3350,  label_y:3650,  troop_x:3380,  troop_y:3790  },
  W3:  { label_x:3980,  label_y:3820,  troop_x:4010,  troop_y:3960  },
  W4:  { label_x:2420,  label_y:4350,  troop_x:2450,  troop_y:4490  },
  W5:  { label_x:3300,  label_y:4500,  troop_x:3330,  troop_y:4640  },
  W6:  { label_x:4120,  label_y:4580,  troop_x:4150,  troop_y:4720  },
  W7:  { label_x:2300,  label_y:5250,  troop_x:2330,  troop_y:5390  },
  W8:  { label_x:3280,  label_y:5180,  troop_x:3310,  troop_y:5320  },
  W9:  { label_x:4080,  label_y:5180,  troop_x:4110,  troop_y:5320  },
};

// ─── Territory metadata ────────────────────────────────────────────────────────

const TERRITORY_META: {
  territory_id: string;
  name: string;
  continent_id: string;
  region_id: string;
  terrain: 'plains'|'mountains'|'coastal'|'forest'|'swamp';
  resource_distribution: {brick:number,lumber:number,wool:number,grain:number,ore:number};
}[] = [
  // FRACTURE BASIN
  { territory_id:'B1',  name:'North Ruin Gate', continent_id:'fracture_basin', region_id:'northern_ruins',     terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B2',  name:'Old Bastion',     continent_id:'fracture_basin', region_id:'northern_ruins',     terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B3',  name:'Highbridge',      continent_id:'fracture_basin', region_id:'northern_ruins',     terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B4',  name:'East Rupture',    continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'mountains', resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B5',  name:'West Crucible',   continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B6',  name:'Crownbreak',      continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B7',  name:'Glass Rift',      continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B8',  name:'Southwatch Ruins',continent_id:'fracture_basin', region_id:'southern_ruins',     terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B9',  name:'Golden Causeway', continent_id:'fracture_basin', region_id:'southern_ruins',     terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  { territory_id:'B10', name:'Riftmarket',      continent_id:'fracture_basin', region_id:'southern_ruins',     terrain:'plains',    resource_distribution:{brick:15,lumber:0,wool:0,grain:25,ore:60} },
  // SHATTERED COAST
  { territory_id:'C1',  name:'Northcliff',      continent_id:'shattered_coast', region_id:'northern_isles',    terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  { territory_id:'C2',  name:'Saltwind Pass',   continent_id:'shattered_coast', region_id:'northern_isles',    terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  { territory_id:'C3',  name:'Broken Harbor',   continent_id:'shattered_coast', region_id:'northern_isles',    terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  { territory_id:'C4',  name:'Blacktide Gate',  continent_id:'shattered_coast', region_id:'southern_fractures',terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  { territory_id:'C5',  name:'Shardport',       continent_id:'shattered_coast', region_id:'southern_fractures',terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  { territory_id:'C6',  name:'Mirror Cape',     continent_id:'shattered_coast', region_id:'southern_fractures',terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  { territory_id:'C7',  name:'Tidebreak',       continent_id:'shattered_coast', region_id:'southern_fractures',terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  { territory_id:'C8',  name:'Southwake',       continent_id:'shattered_coast', region_id:'southern_fractures',terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:35,grain:20,ore:35} },
  // IRONSPINE
  { territory_id:'I1',  name:'Frostgate',       continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains', resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  { territory_id:'I2',  name:'Northpass',       continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains', resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  { territory_id:'I3',  name:'Cliffwatch',      continent_id:'ironspine', region_id:'outer_passes', terrain:'coastal',   resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  { territory_id:'I4',  name:'Greyhold',        continent_id:'ironspine', region_id:'high_crown',   terrain:'mountains', resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  { territory_id:'I5',  name:'Crownforge',      continent_id:'ironspine', region_id:'high_crown',   terrain:'mountains', resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  { territory_id:'I6',  name:'Ridgefall',       continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains', resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  { territory_id:'I7',  name:'Basinwatch',      continent_id:'ironspine', region_id:'high_crown',   terrain:'mountains', resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  { territory_id:'I8',  name:'Eastspire',       continent_id:'ironspine', region_id:'high_crown',   terrain:'mountains', resource_distribution:{brick:5,lumber:5,wool:5,grain:5,ore:80} },
  // SUNFIELDS
  { territory_id:'S1',  name:'Westmeadow',      continent_id:'sunfields', region_id:'western_plains',    terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S2',  name:'Sunroad',         continent_id:'sunfields', region_id:'western_plains',    terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S3',  name:'Harvest Ford',    continent_id:'sunfields', region_id:'western_plains',    terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S4',  name:'Amberhold',       continent_id:'sunfields', region_id:'western_plains',    terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S5',  name:'Granary Cross',   continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S6',  name:'Dawnmarch',       continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S7',  name:'South Orchard',   continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S8',  name:'Lowgold',         continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains', resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  { territory_id:'S9',  name:'Coastward Fields',continent_id:'sunfields', region_id:'eastern_granaries', terrain:'coastal',resource_distribution:{brick:5,lumber:10,wool:25,grain:55,ore:5} },
  // WILD FRONTIER
  { territory_id:'W1',  name:'Thornwood Edge',  continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W2',  name:'Greenmarch',      continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W3',  name:'Broken Pines',    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W4',  name:'Mossfen',         continent_id:'wild_frontier', region_id:'deepwoods',      terrain:'swamp',  resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W5',  name:'Wildcross',       continent_id:'wild_frontier', region_id:'deepwoods',      terrain:'forest', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W6',  name:'Emberwood',       continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W7',  name:'Lowbranch',       continent_id:'wild_frontier', region_id:'deepwoods',      terrain:'plains', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W8',  name:'Riverholt',       continent_id:'wild_frontier', region_id:'deepwoods',      terrain:'plains', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
  { territory_id:'W9',  name:'Ashen Ford',      continent_id:'wild_frontier', region_id:'deepwoods',      terrain:'plains', resource_distribution:{brick:5,lumber:55,wool:20,grain:15,ore:5} },
];

// ─── Adjacency ────────────────────────────────────────────────────────────────

const ADJACENCY: [string, string][] = [
  ['I1','I2'],['I1','I4'],['I1','W1'],
  ['I2','I3'],['I2','I5'],['I2','B1'],
  ['I3','I6'],['I3','C1'],
  ['I4','I5'],['I4','I7'],['I4','W2'],
  ['I5','I6'],['I5','I7'],['I5','B2'],
  ['I6','I8'],['I6','C2'],
  ['I7','I8'],['I7','B3'],
  ['I8','B4'],['I8','C3'],
  ['W1','W2'],['W1','W4'],
  ['W2','W3'],['W2','W5'],
  ['W3','W6'],['W3','B1'],
  ['W4','W5'],['W4','W7'],
  ['W5','W6'],['W5','W8'],['W5','B2'],
  ['W6','W9'],['W6','B5'],
  ['W7','W8'],['W7','S1'],
  ['W8','W9'],['W8','S2'],
  ['W9','B6'],['W9','S3'],
  ['B1','B2'],['B1','B5'],
  ['B2','B3'],['B2','B5'],
  ['B3','B4'],['B3','B6'],
  ['B4','C3'],['B4','B7'],
  ['B5','B6'],['B5','B8'],
  ['B6','B7'],['B6','B9'],
  ['B7','C4'],['B7','B10'],
  ['B8','S3'],['B8','B9'],
  ['B9','S5'],['B9','B10'],
  ['B10','C6'],['B10','S6'],
  ['S1','S2'],['S1','S4'],
  ['S2','S3'],['S2','S5'],
  ['S3','S6'],
  ['S4','S5'],['S4','S7'],
  ['S5','S6'],['S5','S8'],
  ['S6','S9'],
  ['S7','S8'],
  ['S8','S9'],
  ['S9','C8'],
  ['C1','C2'],['C1','C4'],
  ['C2','C3'],['C2','C5'],
  ['C3','C5'],
  ['C4','C5'],['C4','C6'],
  ['C5','C6'],['C5','C7'],
  ['C6','C7'],['C6','C8'],
  ['C7','C8'],
];

// ─── Map definition ───────────────────────────────────────────────────────────

export const MAP_SHATTERED_CROWN: MapDefinition = {
  id: 'shattered_crown_v1',
  name: 'The Shattered Crown',
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players.',
  width:  10240,
  height: 10240,
  min_players: 5,
  max_players: 7,

  background_image_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/7af44e9bf_SHATTERED_CROWN_MAP_PNG.png',

  continents: [
    { id:'ironspine',       name:'Ironspine',       control_bonus:7,  color:'#64748b' },
    { id:'wild_frontier',   name:'Wild Frontier',   control_bonus:8,  color:'#16a34a' },
    { id:'fracture_basin',  name:'Fracture Basin',  control_bonus:10, color:'#dc2626' },
    { id:'sunfields',       name:'Sunfields',       control_bonus:8,  color:'#ca8a04' },
    { id:'shattered_coast', name:'Shattered Coast', control_bonus:7,  color:'#0891b2' },
  ],

  regions: [
    { id:'outer_passes',       name:'Outer Passes',       continent_id:'ironspine',       control_bonus:2, color:'#475569' },
    { id:'high_crown',         name:'High Crown',         continent_id:'ironspine',       control_bonus:3, color:'#334155' },
    { id:'northern_wilds',     name:'Northern Wilds',     continent_id:'wild_frontier',   control_bonus:3, color:'#15803d' },
    { id:'deepwoods',          name:'Deepwoods',          continent_id:'wild_frontier',   control_bonus:3, color:'#166534' },
    { id:'northern_ruins',     name:'Northern Ruins',     continent_id:'fracture_basin',  control_bonus:3, color:'#b91c1c' },
    { id:'central_crossroads', name:'Central Crossroads', continent_id:'fracture_basin',  control_bonus:4, color:'#991b1b' },
    { id:'southern_ruins',     name:'Southern Ruins',     continent_id:'fracture_basin',  control_bonus:3, color:'#dc2626' },
    { id:'western_plains',     name:'Western Plains',     continent_id:'sunfields',       control_bonus:2, color:'#b45309' },
    { id:'eastern_granaries',  name:'Eastern Granaries',  continent_id:'sunfields',       control_bonus:3, color:'#92400e' },
    { id:'northern_isles',     name:'Northern Isles',     continent_id:'shattered_coast', control_bonus:2, color:'#0e7490' },
    { id:'southern_fractures', name:'Southern Fractures', continent_id:'shattered_coast', control_bonus:3, color:'#0369a1' },
  ],

  territories: TERRITORY_META.map(t => {
    const poly = POLYS[t.territory_id] ?? [];
    const {cx, cy} = centroid(poly);
    const anchors = ANCHORS[t.territory_id];
    return {
      territory_id:          t.territory_id,
      name:                  t.name,
      continent_id:          t.continent_id,
      region_id:             t.region_id,
      terrain:               t.terrain,
      points:                pts(poly),
      cx,
      cy,
      troop_x:               anchors?.troop_x ?? cx,
      troop_y:               anchors?.troop_y ?? cy,
      label_x:               anchors?.label_x ?? cx,
      label_y:               anchors?.label_y ?? cy,
      resource_distribution: t.resource_distribution,
    };
  }),

  adjacency: ADJACENCY,
};