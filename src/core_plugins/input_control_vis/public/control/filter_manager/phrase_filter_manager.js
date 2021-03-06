import _ from 'lodash';
import { FilterManager } from './filter_manager.js';
import { buildPhraseFilter } from 'ui/filter_manager/lib/phrase';
import { buildPhrasesFilter } from 'ui/filter_manager/lib/phrases';

export class PhraseFilterManager extends FilterManager {
  constructor(controlId, fieldName, indexPattern, queryFilter) {
    super(controlId, fieldName, indexPattern, queryFilter, []);
  }

  /**
   * Convert phrases into filter
   *
   * @param {array}
   * @return {object} query filter
   *   single phrase: match query
   *   multiple phrases: bool query with should containing list of match_phrase queries
   */
  createFilter(selectedOptions) {
    const phrases = selectedOptions.map(phrase => {
      return phrase.value;
    });
    let newFilter;
    if (phrases.length === 1) {
      newFilter = buildPhraseFilter(
        this.indexPattern.fields.byName[this.fieldName],
        phrases[0],
        this.indexPattern);
    } else {
      newFilter = buildPhrasesFilter(
        this.indexPattern.fields.byName[this.fieldName],
        phrases,
        this.indexPattern);
    }
    newFilter.meta.controlledBy = this.controlId;
    return newFilter;
  }

  getValueFromFilterBar() {
    const kbnFilters = this.findFilters();
    if (kbnFilters.length === 0) {
      return this.getUnsetValue();
    } else {
      return kbnFilters
        .map((kbnFilter) => {
          return this._getValueFromFilter(kbnFilter);
        })
        .reduce((accumulator, currentValue) => {
          return accumulator.concat(currentValue);
        }, [])
        .map(value => {
          return { value, label: value };
        });
    }
  }

  /**
   * Extract filtering value from kibana filters
   *
   * @param {object} kbnFilter
   * @return {Array.<string>} array of values pulled from filter
   */
  _getValueFromFilter(kbnFilter) {
    // bool filter - multiple phrase filters
    if (_.has(kbnFilter, 'query.bool.should')) {
      return _.get(kbnFilter, 'query.bool.should')
        .map((kbnFilter) => {
          return this._getValueFromFilter(kbnFilter);
        })
        .filter((value) => {
          if (value) {
            return true;
          }
          return false;
        });
    }

    // scripted field filter
    if (_.has(kbnFilter, 'script')) {
      return _.get(kbnFilter, 'script.script.params.value', this.getUnsetValue());
    }

    // single phrase filter
    if (_.has(kbnFilter, ['query', 'match', this.fieldName])) {
      return _.get(kbnFilter, ['query', 'match', this.fieldName, 'query'], this.getUnsetValue());
    }

    // single phrase filter from bool filter
    if (_.has(kbnFilter, ['match_phrase', this.fieldName])) {
      return _.get(kbnFilter, ['match_phrase', this.fieldName], this.getUnsetValue());
    }

    return this.getUnsetValue();
  }
}
