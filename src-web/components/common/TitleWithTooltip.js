/* Copyright (c) 2021 Red Hat, Inc. */
/* Copyright Contributors to the Open Cluster Management project */

'use strict'

import React from 'react'
import PropTypes from 'prop-types'
import { Title } from '@patternfly/react-core'
import { GrayOutlinedQuestionCircleIcon } from './Icons'

const TitleWithTooltip = ({className, headingLevel, position, title, tooltip}) => {
  return <div className={className}>
      <Title headingLevel={headingLevel}>
        {title}
      </Title>
      <div className='GrayOutlinedQuestionCircleIcon'>
        {GrayOutlinedQuestionCircleIcon({tooltip, position})}
      </div>
    </div>
}

TitleWithTooltip.propTypes = {
  className: PropTypes.string,
  headingLevel: PropTypes.string,
  position: PropTypes.string,
  title: PropTypes.string,
  tooltip: PropTypes.string,
}

export default TitleWithTooltip
