import React from 'react';
import { SLCompactDropdown } from '@/components/ui/sl-compact-dropdown';
import { ledgerContextOptions, ledgerContextDestination, type LedgerRecordFamily, type LedgerHistoryCollection } from '@/lib/ledger-navigation';

type Props = { section:'records'; value:LedgerRecordFamily; onChange:(value:LedgerRecordFamily)=>void } | { section:'history'; value:LedgerHistoryCollection; onChange:(value:LedgerHistoryCollection)=>void };

/** Local choices stay in their chapter and open beside the measured touch target. */
export function LedgerContextFilter(props:Props) {
  const options = ledgerContextOptions(props.section);
  const current = options.find(option => option.key === `${props.section}:${props.value}`) ?? options[0];
  const title = props.section === 'records' ? 'Movement group' : 'History view';
  return <SLCompactDropdown appearance="ledger"
    testID={`ledger-${props.section}-filter-trigger`} menuTestID={`ledger-${props.section}-filter-menu`}
    accessibilityLabel={`${title}: ${current.label}`} accessibilityHint={`Choose ${title.toLowerCase()}`}
    label={current.label} value={current.key} minMenuWidth={208}
    options={options.map(option => ({value:option.key,label:option.label,testID:option.testID}))}
    onValueChange={key => {
      const valid = ledgerContextDestination(props.section, key);
      if (valid?.section === 'records' && props.section === 'records') props.onChange(valid.family);
      else if (valid?.section === 'history' && props.section === 'history') props.onChange(valid.filter);
    }}/>
}
