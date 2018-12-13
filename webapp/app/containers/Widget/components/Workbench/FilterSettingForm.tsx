import * as React from 'react'
import * as classnames from 'classnames'
import moment, {Moment} from 'moment'
import { IDataParamConfig, IDataParamSource } from './Dropbox'
import ConditionalFilterForm from './ConditionalFilterForm'
import { DEFAULT_DATETIME_FORMAT } from '../../../../globalConstants'
import { decodeMetricName } from '../util'
import { uuid } from 'utils/util'
import Transfer from 'antd/lib/transfer'
import radios from 'antd/lib/radio'
const Radio = radios.default
const RadioGroup = radios.Group
const RadioButton = radios.Button
import Button from 'antd/lib/button'
import DatePicker from 'antd/lib/date-picker'
const RangePicker = DatePicker.RangePicker
const styles = require('./Workbench.less')
const utilStyles = require('../../../../assets/less/util.less')

interface IFilterSettingFormProps {
  item: IDataParamSource
  list: string[]
  config: IDataParamConfig
  onSave: (config: IDataParamConfig) => void
  onCancel: () => void
}

interface IFilterSettingFormStates {
  mode: 'value' | 'conditional' | 'date'
  name: string
  type: string
  list: Array<{key: string, title: string}>,
  target: string[]
  filterTree: object
  selectedDate: string
  datepickerValue: [Moment, Moment]
}

export class FilterSettingForm extends React.PureComponent<IFilterSettingFormProps, IFilterSettingFormStates> {
  constructor (props) {
    super(props)
    this.state = {
      mode: 'value',
      name: '',
      type: '',
      list: [],
      target: [],
      filterTree: {},
      selectedDate: 'today',
      datepickerValue: [moment(), moment()]
    }
  }

  private dateRadioSource = [
    [
      { name: '今天', value: 'today' },
      { name: '昨天', value: 'yesterday' },
      { name: '昨天以来', value: 'yesterdayFromNow' }
    ],
    [
      { name: '最近7天', value: '7' },
      { name: '最近30天', value: '30' },
      { name: '最近90天', value: '90' },
      { name: '最近一年', value: '365' }
    ],
    [
      { name: '本周起', value: 'week' },
      { name: '本月起', value: 'month' },
      { name: '本季度起', value: 'quarter' },
      { name: '今年起', value: 'year' }
    ],
    [
      { name: '自定义', value: 'other' }
    ]
  ]
  private conditionalFilterForm = null
  private refHandles = {
    conditionalFilterForm: (f) => this.conditionalFilterForm = f
  }

  public componentWillMount () {
    const { item, config } = this.props
    this.initNameAndType(item)
    this.initFilterSource(item.visualType, config)
  }

  public componentWillReceiveProps (nextProps) {
    const { item, config, list } = nextProps
    if (item) {
      this.initNameAndType(item)
    }
    if (config) {
      this.initFilterSource(item.visualType, config)
    }
    if (list) {
      this.setState({
        list: list.map((l) => ({
          key: l === '' ? uuid(8, 16) : l,
          title: l
        }))
      })
    }
  }

  private initNameAndType = (item) => {
    this.setState({
      name: item.type === 'category' ? item.name : decodeMetricName(item.name),
      type: item.visualType,
      mode: item.visualType === 'date' ? 'date' : item.visualType === 'number' ? 'conditional' : 'value'
    })
  }

  private initFilterSource = (visualType, config) => {
    const { filterSource } = config
    if (filterSource) {
      if (visualType === 'date') {
        this.setState({
          selectedDate: filterSource.selectedDate,
          datepickerValue: filterSource.datepickerValue.map((v) => moment(v))
        })
      } else if (visualType === 'number') {
        this.setState({
          filterTree: filterSource
        })
      } else {
        if (Array.isArray(filterSource)) {
          this.setState({
            target: filterSource,
            mode: 'value'
          })
        } else {
          this.setState({
            filterTree: filterSource,
            mode: 'conditional'
          })
        }
      }
    }
  }

  private radioChange = (e) => {
    this.setState({
      mode: e.target.value
    })
  }

  private transferRender = (item) => item.title
  private transferChange = (target) => {
    this.setState({ target })
  }

  private initFilterTree = () => {
    this.setState({
      filterTree: {
        id: uuid(8, 16),
        root: true,
        type: 'node'
      }
    })
  }

  private addTreeNode = (tree) => {
    this.setState({
      filterTree: tree
    })
  }

  private deleteTreeNode = () => {
    this.setState({
      filterTree: {}
    })
  }

  private getSqlExpresstions = (tree) => {
    const { name, type } = this.state
    if (Object.keys(tree).length) {
      if (tree.type === 'link') {
        const partials = tree.children.map((c) => {
          if (c.type === 'link') {
            return this.getSqlExpresstions(c)
          } else {
            return `${name} ${c.filterOperator} ${this.getFilterValue(c.filterValue, type)}`
          }
        })
        const expressions = partials.join(` ${tree.rel} `)
        return `(${expressions})`
      } else {
        return `${name} ${tree.filterOperator} ${this.getFilterValue(tree.filterValue, type)}`
      }
    } else {
      return ''
    }
  }

  private getFilterValue = (val, type) => {
    if (type === 'number') {
      return val
    } else {
      return `'${val}'`
    }
  }

  private selectDate = (e) => {
    this.setState({
      selectedDate: e.target.value
    })
  }

  private datepickerChange = (dates) => {
    this.setState({
      datepickerValue: dates.slice()
    })
  }

  private getDateSql = () => {
    const { name, selectedDate, datepickerValue } = this.state
    const today = moment().startOf('day').format(DEFAULT_DATETIME_FORMAT)
    const yesterday = moment().startOf('day').subtract(1, 'days').format(DEFAULT_DATETIME_FORMAT)

    if (selectedDate === 'today') {
      return `${name} >= '${today}'`
    } else if (selectedDate === 'yesterday') {
      return `${name} >= '${yesterday}' and ${name} <= '${today}'`
    } else if (selectedDate === 'yesterdayFromNow') {
      return `${name} >= '${yesterday}'`
    } else if (selectedDate === '7') {
      return `${name} >= '${moment().subtract(7, 'days').format(DEFAULT_DATETIME_FORMAT)}'`
    } else if (selectedDate === '30') {
      return `${name} >= '${moment().subtract(30, 'days').format(DEFAULT_DATETIME_FORMAT)}'`
    } else if (selectedDate === '90') {
      return `${name} >= '${moment().subtract(90, 'days').format(DEFAULT_DATETIME_FORMAT)}'`
    } else if (selectedDate === '365') {
      return `${name} >= '${moment().subtract(365, 'days').format(DEFAULT_DATETIME_FORMAT)}'`
    } else if (selectedDate === 'week') {
      return `${name} >= '${moment().startOf('week').format(DEFAULT_DATETIME_FORMAT)}'`
    } else if (selectedDate === 'month') {
      return `${name} >= '${moment().startOf('month').format(DEFAULT_DATETIME_FORMAT)}'`
    } else if (selectedDate === 'quarter') {
      return `${name} >= '${moment().startOf('quarter').format(DEFAULT_DATETIME_FORMAT)}'`
    } else if (selectedDate === 'year') {
      return `${name} >= '${moment().startOf('year').format(DEFAULT_DATETIME_FORMAT)}'`
    } else {
      return `${name} >= '${datepickerValue[0].format(DEFAULT_DATETIME_FORMAT)}' and ${name} <= '${datepickerValue[1].format(DEFAULT_DATETIME_FORMAT)}'`
    }
  }

  private save = () => {
    const { onSave, onCancel } = this.props
    const { name, mode, target, filterTree, selectedDate, datepickerValue } = this.state
    if (mode === 'value') {
      const sql = target.map((key) => `'${key}'`).join(',')
      if (sql) {
        onSave({
          sql: `${name} in (${sql})`,
          filterSource: target.slice()
        })
      } else {
        onCancel()
      }
    } else if (mode === 'conditional') {
      if (Object.keys(filterTree).length > 0) {
        this.conditionalFilterForm.props.form.validateFieldsAndScroll((err) => {
          if (!err) {
            onSave({
              sql: this.getSqlExpresstions(filterTree),
              filterSource: {...filterTree}
            })
            this.conditionalFilterForm.resetTree()
          }
        })
      } else {
        onCancel()
      }
    } else {
      onSave({
        sql: this.getDateSql(),
        filterSource: {
          selectedDate,
          datepickerValue: datepickerValue.map((m) => m.format(DEFAULT_DATETIME_FORMAT))
        }
      })
    }
  }

  public reset = () => {
    this.setState({
      mode: 'value',
      name: '',
      type: '',
      list: [],
      target: [],
      filterTree: {},
      selectedDate: 'today',
      datepickerValue: [moment(), moment()]
    })
  }

  public render () {
    const { onCancel } = this.props
    const { mode, name, type, list, target, filterTree, selectedDate, datepickerValue } = this.state
    const headerRadios = []

    if (type === 'number') {
      headerRadios.push(
        <RadioButton key="conditional" value="conditional">条件筛选</RadioButton>
      )
    } else if (type === 'date') {
      headerRadios.push(
        <RadioButton key="date" value="date">日期筛选</RadioButton>
      )
    } else {
      headerRadios.push(
        <RadioButton key="value" value="value">值筛选</RadioButton>
      )
      headerRadios.push(
        <RadioButton key="conditional" value="conditional">条件筛选</RadioButton>
      )
    }

    const dateRadios = this.dateRadioSource.map((arr) => {
      return arr.map((s) => (
        <Radio key={s.value} value={s.value} className={styles.radio}>{s.name}</Radio>
      )).concat(<br />)
    })

    let shownBlock
    if (mode === 'value') {
      shownBlock = (
        <div className={styles.valueBlock}>
          <Transfer
            dataSource={list}
            titles={['值列表', '所选值']}
            render={this.transferRender}
            targetKeys={target}
            onChange={this.transferChange}
          />
        </div>
      )
    } else if (mode === 'conditional') {
      shownBlock = (
        <div className={styles.conditionalBlock}>
          <ConditionalFilterForm
            name={name}
            type={type}
            filterTree={filterTree}
            onAddRoot={this.initFilterTree}
            onAddTreeNode={this.addTreeNode}
            onDeleteTreeNode={this.deleteTreeNode}
            wrappedComponentRef={this.refHandles.conditionalFilterForm}
          />
        </div>
      )
    } else {
      shownBlock = (
        <div className={styles.dateBlock}>
          <RadioGroup
            value={selectedDate}
            onChange={this.selectDate}
            className={styles.dateFilterRadios}
          >
            {dateRadios}
          </RadioGroup>
          {selectedDate === 'other' && (
            <RangePicker
              value={datepickerValue}
              format={DEFAULT_DATETIME_FORMAT}
              onChange={this.datepickerChange}
              showTime
            />
          )}
        </div>
      )
    }

    return (
      <div className={styles.filterSettingForm}>
        <div className={styles.header}>
          <RadioGroup onChange={this.radioChange} value={mode}>
            {headerRadios}
          </RadioGroup>
        </div>
        {shownBlock}
        <div className={styles.footer}>
          <Button type="primary" onClick={this.save}>保存</Button>
          <Button onClick={onCancel}>取消</Button>
        </div>
      </div>
    )
  }
}

export default FilterSettingForm
