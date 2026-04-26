export const BODY_KIND_BY_CHAIN_VALUE: Record<string, string> = {
  '1': 'general_council',
  '2': 'treasury_committee',
  '3': 'security_council',
  '4': 'capital_house',
  '5': 'merit_house',
  '6': 'emergency_council',
  '7': 'custom',
};

export const ROLE_TYPE_BY_CHAIN_VALUE: Record<string, string> = {
  '1': 'org_admin',
  '2': 'body_admin',
  '3': 'proposer',
  '4': 'approver',
  '5': 'vetoer',
  '6': 'executor',
  '7': 'emergency_operator',
};

export const PROPOSAL_TYPE_BY_CHAIN_VALUE: Record<string, string> = {
  '1': 'standard',
  '2': 'treasury',
  '3': 'upgrade',
  '4': 'emergency',
};

export const PROPOSAL_STATUS_BY_CHAIN_VALUE: Record<string, string> = {
  '1': 'created',
  '2': 'under_review',
  '3': 'approved',
  '4': 'queued',
  '5': 'vetoed',
  '6': 'executed',
  '7': 'cancelled',
  '8': 'expired',
};

export const ORGANIZATION_STATUS_BY_CHAIN_VALUE: Record<string, string> = {
  '1': 'active',
  '2': 'paused',
  '3': 'archived',
};
