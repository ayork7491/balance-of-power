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

  // Shattered Coast — C1/C2/C3/C4/C5/C7/C8 have incremental (delta) coords in source,
  // so we use the clean absolute coords we had validated previously, scaled to native space.
  // C6, C9 use absolute coords from the file.
  C1: [{x:7482.18,y:2434.29},{x:7724.86,y:2053.71},{x:7228.57,y:1556.57},{x:7095.77,y:1989.26},{x:7202.74,y:2250.74},{x:7483.43,y:1938.74}],
  C2: [{x:8353.79,y:2832.0},{x:8353.79,y:2500.57},{x:7816.0,y:2054.86},{x:7724.86,y:2053.71},{x:7482.18,y:2434.29},{x:8192.0,y:2239.43},{x:8616.69,y:2320.69},{x:8960.38,y:2775.43},{x:8998.4,y:3397.94},{x:8796.09,y:3829.71}],
  C3: [{x:8353.79,y:2832.0},{x:8796.09,y:3829.71},{x:8957.44,y:3100.34},{x:8962.67,y:3122.38},{x:8258.04,y:4729.94},{x:8680.89,y:4960.89},{x:8928.0,y:5188.57},{x:8953.6,y:4716.57},{x:7955.43,y:4790.86},{x:7816.0,y:4429.94}],
  C4: [{x:7816.0,y:4429.94},{x:7955.43,y:4790.86},{x:7729.14,y:5235.77},{x:7330.97,y:5435.2},{x:7169.28,y:5148.57},{x:7169.28,y:4778.97},{x:7203.43,y:4436.57},{x:7330.97,y:4101.71}],
  C5: [{x:8258.04,y:4960.89},{x:8680.89,y:4960.89},{x:8953.6,y:5435.2},{x:8966.86,y:5818.97},{x:8796.09,y:6196.57},{x:8353.79,y:6401.14},{x:7955.43,y:6261.94},{x:7729.14,y:5884.23},{x:7729.14,y:5235.77},{x:7955.43,y:4790.86}],
  C6: [{x:6660.44,y:5461.33},{x:6830.22,y:5158.22},{x:6850.67,y:5078.22},{x:7009.78,y:5175.11},{x:7065.78,y:5081.78},{x:7167.11,y:5223.11},{x:7385.78,y:5417.78},{x:7327.11,y:5527.11},{x:7369.78,y:5629.33},{x:7225.78,y:5691.56},{x:7106.67,y:5805.33},{x:6832.0,y:5638.22}],
  C7: [{x:8796.09,y:6196.57},{x:8966.86,y:5818.97},{x:9362.29,y:5923.2},{x:9633.37,y:6328.23},{x:9633.37,y:6844.0},{x:9362.29,y:7165.71},{x:8966.86,y:7323.2},{x:8796.09,y:7027.43}],
  C8: [{x:7428.44,y:5920.89},{x:7431.11,y:5904.89},{x:7460.44,y:5681.78},{x:7627.56,y:5477.33},{x:7718.67,y:5613.33},{x:7863.56,y:5597.33},{x:8008.44,y:5826.67},{x:8131.99,y:6056.0},{x:8170.22,y:6250.67},{x:7918.67,y:6296.0},{x:7803.99,y:6273.78},{x:7652.0,y:6135.99}],

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
    return {
      territory_id:          t.territory_id,
      name:                  t.name,
      continent_id:          t.continent_id,
      region_id:             t.region_id,
      terrain:               t.terrain,
      points:                pts(poly),
      cx,
      cy,
      troop_x:               cx,
      troop_y:               cy,
      label_x:               cx,
      label_y:               cy,
      resource_distribution: t.resource_distribution,
    };
  }),

  adjacency: ADJACENCY,
};