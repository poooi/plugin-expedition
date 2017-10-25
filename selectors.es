import memoize from 'fast-memoize'
import { createSelector } from 'reselect'
import { sum, flatten } from 'lodash'

import { arraySum, arrayAdd, arrayMultiply } from 'views/utils/tools'
import {
  constSelector,
  shipsSelector,
  fleetShipsIdSelectorFactory,
  fleetShipsDataSelectorFactory,
  fleetShipsEquipDataSelectorFactory,
  extensionSelectorFactory,
} from 'views/utils/selectors'

const REDUCER_EXTENSION_KEY = 'poi-plugin-expedition'

const isDrum = equipData =>
  equipData && equipData[1] && equipData[1].api_id === 75

const shipNotHeavilyDamaged = ship => ship.api_nowhp * 4 >= ship.api_maxhp

// for toku daihatsu 特大発動艇, the calculation is seperated into 2 parts
// the former is to see it as normal daihatsu (5%)
// the latter is to calculate extra bonus introduced by itself
const landingCraftsId = {
  68: 5, // 大発動艇
  166: 2, // 大発動艇(八九式中戦車&陸戦隊)
  167: 1, // 特二式内火艇
  193: 5, // 特大発動艇
}

const shipId = {
  487: 5,
}

// Return [ baseFactorPercentage, starLevel ]
// Return undefined for invalid or empty equips
const landingCraftFactor = (equipData) => {
  if (!Array.isArray(equipData) || !equipData[0]) {
    return undefined
  }
  const equip = equipData[0]
  const factor = landingCraftsId[equip.api_slotitem_id]
  if (factor == null) {
    return [0, 0]
  }
  return [factor, equip.api_level || 0]
}

// calculates the bonus brought by ship herself
const shipFactor = constIds =>
  constIds.reduce(
    (factor, id) =>
      factor + (shipId[id] || 0)
    , 0
  )

const bonusItem = [193]

// calculates extra bonus from toku daihatsu
const bonusFactor = (shipsEquipData) => {
  const bonusCount = shipsEquipData.reduce((count, equipsData) => count + equipsData.reduce(
    (_count, equip = []) =>
      _count + (bonusItem.includes((equip[1] || {}).api_id) ? 1 : 0)
    , 0
  ), 0)

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
    shipsData =>
      (shipsData == null || shipsData[0] == null || !shipsData[0].length
        ? 0
        : shipsData[0][0].api_lv)
  ))

const fleetTotalLvSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      (shipsData == null ? 0 : sum(shipsData.map(shipData =>
        (shipData == null || !shipData[0] ? 0 : shipData[0].api_lv))))
  ))

const fleetShipsTypeSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      (shipsData == null ? [] : shipsData.map(shipData =>
        (shipData == null || !shipData[1] ? undefined : shipData[1].api_stype)))
  ))

const fleetFlagshipTypeSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsTypeSelectorFactory(fleetId),
    shipsType =>
      (shipsType == null ? undefined : shipsType[0])
  ))

// Returns the total number of drums equipped in the fleet
const fleetDrumCountSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsEquipDataSelectorFactory(fleetId),
    (shipsEquipData = []) =>
      sum(shipsEquipData.map(equipsData =>
        equipsData.filter(isDrum).length))
  ))

// Returns the total number of ships with a drum equipped in the fleet
const fleetDrumCarrierCountSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsEquipDataSelectorFactory(fleetId),
    (shipsEquipData = []) =>
      shipsEquipData.filter(equipsData =>
        equipsData.find(isDrum)).length
  ))

// Returns false if the flagship is heavily damaged
const fleetFlagshipHealthySelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      (shipsData == null || shipsData[0] == null || !shipsData[0].length
        ? true
        : shipNotHeavilyDamaged(shipsData[0][0]))
  ))

function shipFullyResupplied(shipData = []) {
  const [ship, $ship] = shipData
  return (!ship || !$ship)
    ? true
    : ship.api_fuel >= $ship.api_fuel_max && ship.api_bull >= $ship.api_bull_max
}

// Returns false if any ship is not fully resupplied
const fleetFullyResuppliedSelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      (shipsData == null
        ? true
        : shipsData.every(shipFullyResupplied))
  ))

function shipMaxResupply(shipData = []) {
  const $ship = shipData[1]
  return (!$ship) ? [0, 0] : [$ship.api_fuel_max, $ship.api_bull_max]
}

// Returns [fuel, bull] consumed to fully resupply every ship from empty
const fleetMaxResupplySelectorFactory = memoize(fleetId =>
  createSelector(
    fleetShipsDataSelectorFactory(fleetId),
    (shipsData) => {
      const resupplies = shipsData == null ? []
        : shipsData.map(shipMaxResupply)
      return arraySum(resupplies)
    }
  ))

const fleetConstShipIdSelectorFactory = memoize(fleetId =>
  createSelector(
    [
      fleetShipsIdSelectorFactory(fleetId),
      shipsSelector,
    ],
    (ids = [], ships) => ids.map(id => (ships[id] || {}).api_ship_id || -1)
  ))

// Returns the bonus percentage brought by landing crafts
// e.g. 20 means 20% bonus, or x1.2 factor
const fleetLandingCraftFactorSelectorFactory = memoize(fleetId =>
  createSelector(
    [
      fleetShipsEquipDataSelectorFactory(fleetId),
      fleetConstShipIdSelectorFactory(fleetId),
    ],
    (shipsEquipData = [], constIds) => {
      const landingCrafts = flatten(shipsEquipData.map(equipsData =>
        equipsData.map(landingCraftFactor).filter(Boolean)))
      const lcFactors = arraySum(landingCrafts)
      const baseFactor = Math.min((lcFactors[0] || 0) + shipFactor(constIds), 20)
      const avgStars = (lcFactors[1] / landingCrafts.length) || 0
      const starFactor = 1 * avgStars * baseFactor
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
], (
  shipCount, flagshipLv, totalLv, shipsType, flagshipType,
  drumCount, drumCarrierCount, flagshipHealthy, fullyResupplied
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