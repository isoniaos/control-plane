import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type {
  BodyDto,
  GovernanceGraphDto,
  MandateDto,
  OrganizationDto,
  OrganizationOverviewDto,
  ProposalDto,
  ProposalRouteExplanationDto,
  ProposalSummaryDto,
  RoleDto,
} from '@isonia/types';
import { ReadModelsService } from './read-models.service';

@Controller('v1')
export class ReadModelsController {
  constructor(private readonly readModels: ReadModelsService) {}

  @Get('orgs')
  getOrganizations(): Promise<OrganizationDto[]> {
    return this.readModels.getOrganizations();
  }

  @Get('orgs/:orgId')
  async getOrganization(@Param('orgId') orgId: string): Promise<OrganizationDto> {
    const organization = await this.readModels.getOrganization(orgId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  @Get('orgs/:orgId/overview')
  async getOverview(@Param('orgId') orgId: string): Promise<OrganizationOverviewDto> {
    const overview = await this.readModels.getOverview(orgId);
    if (!overview) {
      throw new NotFoundException('Organization not found');
    }
    return overview;
  }

  @Get('orgs/:orgId/bodies')
  getBodies(@Param('orgId') orgId: string): Promise<BodyDto[]> {
    return this.readModels.getBodies(orgId);
  }

  @Get('orgs/:orgId/roles')
  getRoles(@Param('orgId') orgId: string): Promise<RoleDto[]> {
    return this.readModels.getRoles(orgId);
  }

  @Get('orgs/:orgId/mandates')
  getMandates(@Param('orgId') orgId: string): Promise<MandateDto[]> {
    return this.readModels.getMandates(orgId);
  }

  @Get('orgs/:orgId/holders/:address/mandates')
  getHolderMandates(@Param('orgId') orgId: string, @Param('address') address: string): Promise<MandateDto[]> {
    return this.readModels.getHolderMandates(orgId, address);
  }

  @Get('orgs/:orgId/proposals')
  getProposals(@Param('orgId') orgId: string): Promise<ProposalSummaryDto[]> {
    return this.readModels.getProposals(orgId);
  }

  @Get('orgs/:orgId/proposals/:proposalId')
  async getProposal(@Param('orgId') orgId: string, @Param('proposalId') proposalId: string): Promise<ProposalDto> {
    const proposal = await this.readModels.getProposal(orgId, proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }
    return proposal;
  }

  @Get('orgs/:orgId/proposals/:proposalId/route')
  async getProposalRoute(
    @Param('orgId') orgId: string,
    @Param('proposalId') proposalId: string,
  ): Promise<ProposalRouteExplanationDto> {
    const route = await this.readModels.getProposalRoute(orgId, proposalId);
    if (!route) {
      throw new NotFoundException('Proposal not found');
    }
    return route;
  }

  @Get('orgs/:orgId/graph')
  async getGraph(@Param('orgId') orgId: string): Promise<GovernanceGraphDto> {
    const graph = await this.readModels.getGraph(orgId);
    if (!graph) {
      throw new NotFoundException('Organization not found');
    }
    return graph;
  }
}
