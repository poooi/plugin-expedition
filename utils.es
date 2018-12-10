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

// Returns [ <error_code> ]
export function expeditionErrors(fleetProperties, $expedition, expeditionData) {
  // const errorInexist = [{ type: 'inexist' }]
  const props = fleetProperties // Make it shorter

  if (!$expedition) {
    return [] // do not give error
  }
  const expedition = expeditionData || ($expedition.api_return_flag === 0 ? SupportExpeditionData : null)
  // Has $expedition, but no expedition data, and not a support expedition
  if (!expedition) {
    return [] // do not give error
  }

  const errs = []
  if (!props.flagshipHealthy) {
    errs.push({ type: 'flagship_unhealthy' })
  }
  if (!props.fullyResupplied) {
    errs.push({ type: 'resupply' })
  }
  if (expedition.flagship_lv !== 0 && props.flagshipLv < expedition.flagship_lv) {
    errs.push({
      type: 'flagship_lv', detail: true, current: `${props.flagshipLv}`, requirement: `${expedition.flagship_lv}`,
    })
  }
  if (expedition.fleet_lv !== 0 && props.totalLv < expedition.fleet_lv) {
    errs.push({
      type: 'fleet_lv', detail: true, current: `${props.totalLv}`, requirement: `${expedition.fleet_lv}`,
    })
  }
  if (expedition.flagship_shiptype !== 0 && props.flagshipType !== expedition.flagship_shiptype) {
    errs.push({ type: 'flagship_shiptype' })
  }
  if (expedition.ship_count !== 0 && props.shipCount < expedition.ship_count) {
    errs.push({
      type: 'ship_count', detail: true, current: `${props.shipCount}`, requirement: `${expedition.ship_count}`,
    })
  }
  if (expedition.drum_ship_count !== 0 && props.drumCarrierCount < expedition.drum_ship_count) {
    errs.push({
      type: 'drum_ship_count', detail: true, current: `${props.drumCarrierCount}`, requirement: `${expedition.drum_ship_count}`,
    })
  }
  if (expedition.drum_count !== 0 && props.drumCount < expedition.drum_count) {
    errs.push({
      type: 'drum_count', detail: true, current: `${props.drumCount}`, requirement: `${expedition.drum_count}`,
    })
  }
  if (expedition.required_shiptypes.length !== 0) {
    const valid = expedition.required_shiptypes.every(({ shiptype, count }) => props.shipsType.filter(t => shiptype.includes(t)).length >= count)
    if (!valid) {
      errs.push({ type: 'required_shiptypes' })
    }
  }
  if (expedition.required_extra) {
    if (expedition.required_extra.asw) {
      const valid = props.totalAWS >= expedition.required_extra.asw
      if (!valid) {
        errs.push({ type: 'asw', detail: true, current: props.totalAWS, requirement: expedition.required_extra.asw })
      }
    }
    if (expedition.required_extra.aa) {
      const valid = props.totalAA >= expedition.required_extra.aa
      if (!valid) {
        errs.push({ type: 'aa', detail: true, current: props.totalAA, requirement: expedition.required_extra.aa })
      }
    }
    if (expedition.required_extra.los) {
      const valid = props.totalLOS >= expedition.required_extra.los
      if (!valid) {
        errs.push({ type: 'los', detail: true, current: props.totalLOS, requirement: expedition.required_extra.los })
      }
    }
    if (expedition.required_extra.firepower) {
      const valid = props.totalFirepower >= expedition.required_extra.firepower
      if (!valid) {
        errs.push({ type: 'firepower', detail: true, current: props.totalFirepower, requirement: expedition.required_extra.firepower })
      }
    }
  }
  return errs
}
