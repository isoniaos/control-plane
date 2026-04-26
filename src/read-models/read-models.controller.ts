import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ReadModelsService } from './read-models.service';

@Controller('v1')
export class ReadModelsController {
  constructor(private readonly readModels: ReadModelsService) {}

  @Get('orgs')
  getOrganizations(): Promise<unknown[]> {
    return this.readModels.getOrganizations();
  }

  @Get('orgs/:orgId')
  async getOrganization(@Param('orgId') orgId: string): Promise<unknown> {
    const organization = await this.readModels.getOrganization(orgId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  @Get('orgs/:orgId/overview')
  async getOverview(@Param('orgId') orgId: string): Promise<unknown> {
    const overview = await this.readModels.getOverview(orgId);
    if (!overview) {
      throw new NotFoundException('Organization not found');
    }
    return overview;
  }

  @Get('orgs/:orgId/bodies')
  getBodies(@Param('orgId') orgId: string): Promise<unknown[]> {
    return this.readModels.getBodies(orgId);
  }

  @Get('orgs/:orgId/roles')
  getRoles(@Param('orgId') orgId: string): Promise<unknown[]> {
    return this.readModels.getRoles(orgId);
  }

  @Get('orgs/:orgId/mandates')
  getMandates(@Param('orgId') orgId: string): Promise<unknown[]> {
    return this.readModels.getMandates(orgId);
  }

  @Get('orgs/:orgId/holders/:address/mandates')
  getHolderMandates(@Param('orgId') orgId: string, @Param('address') address: string): Promise<unknown[]> {
    return this.readModels.getHolderMandates(orgId, address);
  }

  @Get('orgs/:orgId/proposals')
  getProposals(@Param('orgId') orgId: string): Promise<unknown[]> {
    return this.readModels.getProposals(orgId);
  }

  @Get('orgs/:orgId/proposals/:proposalId')
  async getProposal(@Param('orgId') orgId: string, @Param('proposalId') proposalId: string): Promise<unknown> {
    const proposal = await this.readModels.getProposal(orgId, proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }
    return proposal;
  }

  @Get('orgs/:orgId/proposals/:proposalId/route')
  async getProposalRoute(@Param('orgId') orgId: string, @Param('proposalId') proposalId: string): Promise<unknown> {
    const route = await this.readModels.getProposalRoute(orgId, proposalId);
    if (!route) {
      throw new NotFoundException('Proposal not found');
    }
    return route;
  }

  @Get('orgs/:orgId/graph')
  getGraph(@Param('orgId') orgId: string): Promise<unknown> {
    return this.readModels.getGraph(orgId);
  }
}
