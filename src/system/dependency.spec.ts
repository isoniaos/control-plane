import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AccountabilityExecutionStatus,
  ArchiveProposalDisplayState,
  DecisionRecordResult,
  ExternalResourceProvider,
  GovernanceRecordSourceCategory,
} from '@isonia/types';

describe('package dependencies', () => {
  it('uses the alpha workspace link for @isonia/types', () => {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(packageJson.dependencies?.['@isonia/types']).toBe('workspace:*');
  });

  it('uses v0.8 archive and accountability root exports from @isonia/types', () => {
    expect(AccountabilityExecutionStatus.Completed).toBe('completed');
    expect(ArchiveProposalDisplayState.Executed).toBe('executed');
    expect(DecisionRecordResult.Approved).toBe('approved');
    expect(ExternalResourceProvider.BlockExplorer).toBe('block_explorer');
    expect(GovernanceRecordSourceCategory.ContractReadModel).toBe(
      'contract_read_model',
    );
  });
});
