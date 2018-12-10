import memoize from 'fast-memoize'
import { createSelector } from 'reselect'
import _, { sum, flatten, get } from 'lodash'

import { arraySum, arrayAdd, arrayMultiply } from 'views/utils/tools'
import {
  constSelector,
  fleetShipsIdSelectorFactory,
  fleetShipsDataSelectorFactory,
  fleetShipsEquipDataSelectorFactory,
  extensionSelectorFactory,
} from 'views/utils/selectors'

const REDUCER_EXTENSION_KEY = 'poi-plugin-expedition'

const isDrum = equipData => get(equipData, [1, 'api_id'], -1) === 75

const shipNotHeavilyDamaged = ship => ship.api_nowhp * 4 >= ship.api_maxhp

// for toku daihatsu 特大発動艇, the calculation is seperated into 2 parts
// the former is to see it as normal daihatsu (5%)
// the latter is to calculate extra bonus introduced by itself
const bonusByItem = {
  68: 5, // 大発動艇
  166: 2, // 大発動艇(八九式中戦車&陸戦隊)
  167: 1, // 特二式内火艇
  193: 5, // 特大発動艇
}

// Kinu Kai 2
const bonusByShip = {
  487: 5,
}

// calculates the bonus brought by ship herself
const shipFactor = constIds =>
  constIds.reduce(
    (factor, id) =>
      factor + (bonusByShip[id] || 0)
    , 0
  )

const bonusItem = [193]

// calculates extra bonus from toku daihatsu, in percentage
const bonusFactor = (shipsEquipData) => {
  const bonusCount = _(shipsEquipData)
    .flatten()
    .filter(equip => bonusItem.includes(get(equip, [1, 'api_id'], 0)))
    .size()

  switch (true) {
    case (bonusCount === 3):
      return 5
    case (bonusCount >= 4):
      return 5.4
    case (bonusCount < 0):
      return 0
    default:
      return bonusCount * 2
  }
}

const fleetShipCountSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsIdSelectorFactory(fleetId),
    shipsId =>
      (shipsId == null ? 0 : shipsId.length)
  ))

const fleetFlagshipLvSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => get(shipsData, [0, 0, 'api_lv'], 0)
  ))

const fleetTotalLvSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => _(shipsData).map(ship => get(ship, [0, 'api_lv'], 0)).sum()
  ))


const fleetTotalASWSelectorFactory = memoize(fleetId =>
  createSelector([
    fleetShipsDataSelectorFactory(fleetId),
    fleetShipsEquipDataSelectorFactory(fleetId),
  ],
    (shipsData, shipsEquipData = []) => {
      const aws = _(shipsData).map(ship => get(ship, [0, 'api_taisen', 0], 0)).sum()
      const equipData = _(shipsEquipData)
        .flatten()
        .filter(equip => [10, 11, 41].includes(get(equip, [1, 'api_type', 2])))
      const extra = equipData
        .sumBy(equip => get(equip, [1, 'api_tais'], 0))
      return aws - extra
    }
  ))

const fleetTotalAASelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => _(shipsData).map(ship => get(ship, [0, 'api_taiku', 0], 0)).sum()
  ))

const fleetTotalLOSSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => _(shipsData).map(ship => get(ship, [0, 'api_sakuteki', 0], 0)).sum()
  ))

const fleetTotalFirepowerSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => _(shipsData).map(ship => get(ship, [0, 'api_karyoku', 0], 0)).sum()
  ))

const fleetShipsTypeSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => _(shipsData).map(ship => get(ship, [1, 'api_stype'], 0)).value()
  ))

const fleetFlagshipTypeSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsTypeSelectorFactory(fleetId),
    shipsType => shipsType[0] || 0
  ))

// Returns the total number of drums equipped in the fleet
const fleetDrumCountSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsEquipDataSelectorFactory(fleetId),
    shipsEquipData => _(shipsEquipData).flatten().filter(isDrum).size()
  ))

// Returns the total number of ships with a drum equipped in the fleet
const fleetDrumCarrierCountSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsEquipDataSelectorFactory(fleetId),
    shipsEquipData => _(shipsEquipData).filter(equips => _(equips).some(isDrum)).size()
  ))

// Returns false if the flagship is heavily damaged
const fleetFlagshipHealthySelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => shipNotHeavilyDamaged(get(shipsData, [0, 0], {}))
  ))

const shipFullyResupplied = ([ship, $ship] = []) => (!ship || !$ship)
  ? true
  : ship.api_fuel >= $ship.api_fuel_max && ship.api_bull >= $ship.api_bull_max

// Returns false if any ship is not fully resupplied
const fleetFullyResuppliedSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => _(shipsData).every(shipFullyResupplied)
  ))

const getShipMaxResupply = ([, $ship] = []) =>
  !$ship ? [0, 0] : [$ship.api_fuel_max, $ship.api_bull_max]

// Returns [fuel, bull] consumed to fully resupply every ship from empty
const fleetMaxResupplySelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData => arraySum(_(shipsData).map(getShipMaxResupply).value())
  ))

const fleetConstShipIdSelectorFactory = memoize(fleetId =>
  createSelector(
    [
      fleetShipsDataSelectorFactory(fleetId),
    ], ships => _(ships).map(([ship] = []) => get(ship, 'api_id', 0)).value()
  ))

// Returns the bonus percentage brought by landing crafts
// e.g. 20 means 20% bonus, or x1.2 factor
const fleetLandingCraftFactorSelectorFactory = memoize(fleetId =>
  createSelector(
    [
      fleetShipsEquipDataSelectorFactory(fleetId),
      fleetConstShipIdSelectorFactory(fleetId),
    ],
    (shipsEquipData = [], shipIds) => {
      const data = _(shipsEquipData)
        .flatten()
        .filter(equip => bonusByItem[get(equip, [1, 'api_id'])] || 0)

      const itemBonus = data
        .sumBy(equip => bonusByItem[get(equip, [1, 'api_id'])] || 0)

      const levels = data
        .sumBy(equip => get(equip, [0, 'api_level'], 0))

      const baseFactor = Math.min(itemBonus + shipFactor(shipIds), 20)
      const avgStars = levels === 0 ? 0 : levels / data.size()
      const starFactor = (avgStars / 100) * baseFactor
      const bonus = bonusFactor(shipsEquipData)
      return {
        base: baseFactor,
        star: starFactor,
        bonus,
      }
    }
  ))

export const fleetPropertiesSelectorFactory = memoize(fleetId => createSelector([
  fleetShipCountSelectorFactory(fleetId),
  fleetFlagshipLvSelectorFactory(fleetId),
  fleetTotalLvSelectorFactory(fleetId),
  fleetShipsTypeSelectorFactory(fleetId),
  fleetFlagshipTypeSelectorFactory(fleetId),
  fleetDrumCountSelectorFactory(fleetId),
  fleetDrumCarrierCountSelectorFactory(fleetId),
  fleetFlagshipHealthySelectorFactory(fleetId),
  fleetFullyResuppliedSelectorFactory(fleetId),
  fleetTotalASWSelectorFactory(fleetId),
  fleetTotalAASelectorFactory(fleetId),
  fleetTotalLOSSelectorFactory(fleetId),
  fleetTotalFirepowerSelectorFactory(fleetId),
], (
  shipCount, flagshipLv, totalLv, shipsType, flagshipType,
  drumCount, drumCarrierCount, flagshipHealthy, fullyResupplied,
  totalAWS, totalAA, totalLOS, totalFirepower,
) => ({
  shipCount,
  flagshipLv,
  totalLv,
  shipsType,
  flagshipType,
  drumCount,
  drumCarrierCount,
  flagshipHealthy,
  fullyResupplied,
  totalAWS,
  totalAA,
  totalLOS,
  totalFirepower,
})))


// Returns [f1, f2, f3] where fx is the fleetProperties of fleet x
// Notice that you should use the form "result[fleetId-1]"
export const fleetsPropertiesSelectorFactory = createSelector([
  fleetPropertiesSelectorFactory(1),
  fleetPropertiesSelectorFactory(2),
  fleetPropertiesSelectorFactory(3),
], (f1, f2, f3) => [f1, f2, f3])

export const expeditionDataSelector = createSelector(
  extensionSelectorFactory(REDUCER_EXTENSION_KEY),
  (state = {}) => state.expeditions || {}
)

export const SupportExpeditionData = {
  reward_fuel: 0,
  reward_bullet: 0,
  reward_steel: 0,
  reward_alum: 0,
  reward_items: [],
  flagship_lv: 0,
  fleet_lv: 0,
  flagship_shiptype: 0,
  ship_count: 2,
  drum_ship_count: 0,
  drum_count: 0,
  required_shiptypes: [
    {
      shiptype: [2],
      count: 2,
    },
  ],
  big_success: null,
}

// Returns [ normalRewards, greatRewards ]
// where rewards := [ fuel, ammo, steel, bauxite ]
// with errs, landing crafts and resupplies taken into account
export const fleetExpeditionRewardsSelectorFactory = memoize((fleetId, expeditionId) =>
  createSelector([
    constSelector,
    expeditionDataSelector,
    fleetLandingCraftFactorSelectorFactory(fleetId),
    fleetMaxResupplySelectorFactory(fleetId),
  ], ({ $missions: $expeditions = {} }, expeditions, lcFactor, maxResupply) => {
    const $expedition = $expeditions[expeditionId]
    if (!$expedition) {
      return [[0, 0, 0, 0], [0, 0, 0, 0]]
    }
    const expedition = expeditions[expeditionId] || SupportExpeditionData
    const baseRewards =
      ['reward_fuel', 'reward_bullet', 'reward_steel', 'reward_alum']
        .map(key => expedition[key])
    const { base, star, bonus } = lcFactor
    const totalFactor = sum([base, star, bonus])
    const lcRewards = arrayMultiply(baseRewards, 1 + (totalFactor / 100))
    const resupply = [
      -maxResupply[0] * $expedition.api_use_fuel,
      -maxResupply[1] * $expedition.api_use_bull,
      0,
      0]
    const normalRewards = arrayAdd(lcRewards, resupply).map(Math.floor)
    const greatRewards = arrayAdd(arrayMultiply(lcRewards, 1.5), resupply).map(Math.floor)
    return {
      normalRewards,
      greatRewards,
      lcFactor,
    }
  }))
