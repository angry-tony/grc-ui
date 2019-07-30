/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2019. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/
'use strict'
//FindingCardModule might be merged with PolicyCardsModule as GrcCardsModule in future for reuse after finding hifi is done
import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { DropdownV2, Icon } from 'carbon-components-react'
import resources from '../../../lib/shared/resources'
import msgs from '../../../nls/platform.properties'
import _ from 'lodash'
import { withRouter } from 'react-router-dom'
import queryString from 'query-string'

resources(() => {
  require('../../../scss/module-policy-cards.scss')
})

const PolicyCardsSelections = Object.freeze({
  categories: 'categories',
  standards: 'standards',
})

class FindingCardModule extends React.Component {

  constructor (props) {
    super(props)
    const {viewState: {policyCardChoice=PolicyCardsSelections.standards}} = props
    this.state = {
      policyCardChoice,
    }
    this.onChange = this.onChange.bind(this)
    this.collapseClick = this.collapseClick.bind(this)
  }

  render() {
    const cardData = this.getCardData()
    const { showPolicyCard } = this.props
    return (
      <div className='module-policy-cards'>
        {this.renderHeader()}
        {showPolicyCard && this.renderCards(cardData)}
      </div>
    )
  }

  renderHeader() {
    const { locale } = this.context
    const collapseHintCollapse = msgs.get('overview.policy.cards.collapseHint.collapse', locale)
    const collapseHintExpand = msgs.get('overview.policy.cards.collapseHint.expand', locale)
    const collapseButtonCollapse = msgs.get('overview.policy.cards.collapseButton.collapse', locale)
    const collapseButtonExpand = msgs.get('overview.policy.cards.collapseButton.expand', locale)
    const { policyCardChoice } = this.state
    const { showPolicyCard } = this.props
    const choices = this.getPolicyCardChoices(locale)
    const title = msgs.get('overview.policy.overview.title', locale)
    const idx = Math.max(0, choices.findIndex(({value})=>{
      return policyCardChoice===value
    }))
    return (
      <div className='header-container'>
        {showPolicyCard && <div className='header-title'>{title}</div>}
        {showPolicyCard &&
        <div>
          <DropdownV2 className='selection'
            label={title}
            ariaLabel={title}
            onChange={this.onChange}
            inline={true}
            initialSelectedItem={choices[idx].label}
            items={choices} />
        </div>}
        <button className='collapse' onClick={this.collapseClick}>
          <span className='collapse-hint'>{showPolicyCard?collapseHintCollapse:collapseHintExpand}</span>
          <span className='collapse-button'>{showPolicyCard?collapseButtonCollapse:collapseButtonExpand}</span>
          {showPolicyCard ? <Icon name='chevron--up' className='arrow-up' description='collapse' /> : <Icon name='chevron--down' className='arrow-down' description='expand' />}
        </button>
      </div>
    )
  }

  renderCards(cardData) {
    const { locale } = this.context
    const { handleDrillDownClick } = this.props
    return (
      <div className='card-container-container' >
        {cardData.map((data) => {
          return <PolicyCard key={data.name} data={data} locale={locale} handleClick={handleDrillDownClick} />
        })}
      </div>
    )
  }

  getCardData = () => {
    const { locale } = this.context
    const { policies, activeFilters } = this.props
    const { policyCardChoice } = this.state
    const other = msgs.get('overview.policy.overview.other', locale)

    // loop thru policies
    const dataMap = {}
    const policyMap = {}
    const clusterMap = {}
    policies.map(policy => {
      // get a policy's standards/categories
      let types, key
      const annotations = _.get(policy, 'metadata.annotations', {}) || {}
      switch (policyCardChoice) {
      case PolicyCardsSelections.categories:
        types = annotations['policy.mcm.ibm.com/categories'] || ''
        key = 'categories'
        break
      case PolicyCardsSelections.standards:
        types = annotations['policy.mcm.ibm.com/standards'] || ''
        key = 'standards'
        break
      }
      // backward compatible and if user doesn't supply an annotation
      if (types.length===0) {
        types=other
      }
      types.split(',').forEach(type=>{
        type = type.trim()
        if (type) {
          let name = type
          if (policyCardChoice===PolicyCardsSelections.categories) {
            name = _.startCase(name)
          }
          const filtered = activeFilters[key] &&  activeFilters[key].size>0 && !activeFilters[key].has(name)
          if (!filtered) {
            let data = dataMap[type]
            if (!data) {
              data = dataMap[type]= {
                name,
                rawName: type,
                choice: policyCardChoice,
                violations: 0,
                counts: {
                  cluster: {
                    violations:0,
                    total:0,
                  },
                  policy: {
                    violations:0,
                    total:0,
                  },
                }
              }
            }

            // if policy has violation
            policyMap[type] = policyMap[type] || {}
            clusterMap[type] = clusterMap[type] || {}
            const statuses = _.get(policy, 'raw.status.status', {})
            const policyName = _.get(policy, 'metadata.name')
            Object.keys(statuses).forEach(clusterName=>{
              const compliant = statuses[clusterName].compliant
              const noncompliant = !compliant || compliant.toLowerCase()==='noncompliant'
              policyMap[type][policyName] = policyMap[type][policyName] || noncompliant
              clusterMap[type][clusterName] = clusterMap[type][clusterName] || noncompliant
            })
          }
        }
      })
    })

    // tabulate for category or standard
    // by policies
    Object.keys(policyMap).forEach(type=>{
      const data = dataMap[type]
      const policies = policyMap[type]
      Object.keys(policies).forEach(policy=>{

        // this is a policy with this category/standard
        data.counts.policy.total++

        // this policy with this category/standard has a violation
        if (policies[policy]) {
          data.counts.policy.violations++
          data.violations++
        }
      })
    })

    // by clusters
    Object.keys(clusterMap).forEach(type=>{
      const data = dataMap[type]
      const clusters = clusterMap[type]
      Object.keys(clusters).forEach(cluster=>{

        // this is a cluster with this category/standard
        data.counts.cluster.total++

        // this cluster with this category/standard has a violation
        if (clusters[cluster]) {
          data.counts.cluster.violations++
          data.violations++
        }
      })
    })

    // convert to array and sort
    return Object.keys(dataMap).map(key=>{
      return {...dataMap[key]}
    }).sort(({name:an, violations:av}, {name:bn, violations:bv})=>{
      const v = bv-av
      if (v===0) {
        if (an===other && bn!==other) {
          return 1
        } else  if (an!==other && bn===other) {
          return -1
        }
        return an.localeCompare(bn)
      }
      return v
    })
  }

  getPolicyCardChoices = (locale) => {
    if (!this.policyCardChoices) {
      this.policyCardChoices = [
        {
          value: PolicyCardsSelections.categories,
          label: msgs.get('overview.policy.cards.categories', locale),
        },
        {
          value: PolicyCardsSelections.standards,
          label: msgs.get('overview.policy.cards.standards', locale),
        },
      ]
    }
    return this.policyCardChoices
  }

  onChange = (e) => {
    const {selectedItem: {value}} = e
    this.props.updateViewState({policyCardChoice: value})
    this.setState(()=>{
      return {policyCardChoice: value}
    })
  }

  collapseClick() {
    const {history, location} = this.props
    const paraURL = queryString.parse(location.search)
    if(typeof paraURL.card === 'undefined'){//when no card flag means true
      paraURL.card = false}
    else{
      paraURL.card = paraURL.card === 'false' ? true : false}
    history.push(`${location.pathname}?${queryString.stringify(paraURL)}`)
  }
}

// functional card component
const PolicyCard = ({data, locale, handleClick}) => {
  const { counts, choice, name } = data
  const countData = Object.keys(counts).map(type=>{
    return {
      ...counts[type],
      violationType: msgs.get(`overview.${type}.violations`, locale),
      choice,
      type,
    }
  })
  return (
    <div key={name}>
      <div className='card-container'>
        <div className='card-content'>
          <div className='card-name'>
            {name}
          </div>
          <div className='card-count-content'>
            {countData.map(({violations, total, violationType, choice, type }) => {
              const violated = violations > 0
              const containerClasses = classNames({
                'card-count-container': true,
                violated,
              })
              const onClick = () =>{
                if (violated) {
                  handleClick(choice, name, type)
                }
              }
              const onKeyPress = (e) =>{
                if ( e.key === 'Enter') {
                  onClick()
                }
              }
              return (
                <div key={violationType} className={containerClasses} role={'button'}
                  tabIndex='0' onClick={onClick} onKeyPress={onKeyPress} >
                  <div className='card-count'>
                    <div className='card-count-violations'>
                      {violations}
                    </div>
                    <div className='card-count-total'>
                      {`/${total}`}
                    </div>
                  </div>
                  <div className='card-violation-type'>
                    {violationType}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

PolicyCard.propTypes = {
  data: PropTypes.object,
  handleClick: PropTypes.func,
  locale: PropTypes.string
}


FindingCardModule.propTypes = {
  activeFilters: PropTypes.object,
  handleDrillDownClick: PropTypes.func,
  history: PropTypes.object.isRequired,
  location: PropTypes.object,
  policies: PropTypes.array,
  showPolicyCard: PropTypes.bool,
  updateViewState: PropTypes.func,
  viewState: PropTypes.object,
}

export default withRouter(FindingCardModule)