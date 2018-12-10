import React from 'react'

const { i18n } = window
const __ = i18n['poi-plugin-expedition'].__.bind(i18n['poi-plugin-expedition'])

const constraintErrorType = {
  inexist: 'Expedition not found',
  flagship_unhealthy: 'Flagship heavily damaged',
  resupply: 'Fleet not resupplied',
  flagship_lv: 'Flagship level too low',
  fleet_lv: 'Fleet total level too low',
  flagship_shiptype: 'Incorrect flagship type',
  ship_count: 'Not enough ships',
  drum_ship_count: 'Not enough drum carriers',
  drum_count: 'Not enough drums',
  required_shiptypes: 'Unmet ship type requirements',
  asw: 'Not enough ASW',
  aa: 'Not enough AA',
  los: 'Not enough LOS',
  firepower: 'Not enough firepower',
  '*': 'Unknown errors',
}

const ErrorList = ({
  errs,
  tableClassName,
  trClassName,
  tdTextClassName,
  tdNumberClassName,
}) => (
  <table className={tableClassName}>
    <tbody>
      {
        errs.map(({
          type, detail, current, requirement,
        }) => {
          const reason = __(constraintErrorType[type] || constraintErrorType['*'])
          const tdWarnNumClassName = `${tdNumberClassName} text-info` // 'text-info' comes from css file from poi style

          return (
            detail ?
              <tr key={type} className={trClassName}>
                <td className={tdTextClassName}>{reason}</td>
                <td className={tdWarnNumClassName}>{current}</td>
                <td className={tdNumberClassName}>{requirement}</td>
              </tr>
              :
              <tr key={type} className={trClassName}>
                <td className={tdTextClassName}>{reason}</td>
              </tr>
          )
        })
      }
    </tbody>
  </table>
)

export default ErrorList
