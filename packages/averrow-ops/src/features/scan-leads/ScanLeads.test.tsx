import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ScanLeadDetail } from './ScanLeads';
import type { ScanLeadDetailResponse } from '@/hooks/useScanLeads';

// Shared mutation mocks so tests can assert the buttons fire them.
const mocks = vi.hoisted(() => ({
  useScanLead: vi.fn(),
  updateMutate: vi.fn(),
  generateMutate: vi.fn(),
  renewMutate: vi.fn(),
  reportSendMutate: vi.fn(),
  outreachMutate: vi.fn(),
  convertMutate: vi.fn(),
}));

vi.mock('@/hooks/useScanLeads', () => ({
  useScanLeads: vi.fn(),
  useScanLead: mocks.useScanLead,
  useUpdateScanLead: () => ({ mutate: mocks.updateMutate, isPending: false }),
  useGenerateQualifiedReport: () => ({ mutate: mocks.generateMutate, isPending: false }),
  useRenewQualifiedReport: () => ({ mutate: mocks.renewMutate, isPending: false }),
  useReportAndOutreach: () => ({ mutate: mocks.reportSendMutate, isPending: false }),
  useSendOutreach: () => ({ mutate: mocks.outreachMutate, isPending: false }),
  useConvertToTenant: () => ({ mutate: mocks.convertMutate, isPending: false }),
}));

const detail: ScanLeadDetailResponse = {
  lead: {
    id: 'lead_1',
    email: 'cto@acme.com',
    name: 'A. Buyer',
    company: 'Acme Corp',
    phone: null,
    domain: 'acme.com',
    form_type: 'scan',
    source: 'homepage',
    message: null,
    status: 'new',
    notes: null,
    correlated_brand_id: null,
    correlated_sales_lead_id: null,
    outreach_sent_at: null,
    outreach_email_id: null,
    converted_org_id: null,
    converted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  intel: {
    domain: 'acme.com',
    threats: { active_total: 3, by_severity: { high: 3 }, samples: [] },
    email_security: { grade: 'D', spf: 'softfail', dmarc: 'none', mx_count: 2 },
    top_providers: [],
    top_countries: [],
    lookalikes_count: 0,
    correlated_brand: null,
    latest_report: {
      share_token: 'tok_abc',
      risk_grade: 'HIGH',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
    platform_history: { known_brand: null, prior_assessment: null },
  },
  correlated_sales_lead: {
    id: 99,
    company_name: 'Acme Corp',
    status: 'researched',
    prospect_score: 80,
    pitch_angle: 'email_security_gap',
    created_at: new Date().toISOString(),
  },
};

describe('ScanLeadDetail — Part B funnel actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useScanLead.mockReturnValue({ data: detail, isLoading: false, isError: false });
  });

  it('renders the Generate & Send and Renew actions', () => {
    renderWithProviders(<ScanLeadDetail leadId="lead_1" onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /generate & send/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^renew$/i })).toBeInTheDocument();
  });

  it('fires report-and-outreach when Generate & Send is clicked', () => {
    renderWithProviders(<ScanLeadDetail leadId="lead_1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /generate & send/i }));
    expect(mocks.reportSendMutate).toHaveBeenCalledTimes(1);
    expect(mocks.reportSendMutate.mock.calls[0][0]).toBe('lead_1');
  });

  it('fires renew when Renew is clicked', () => {
    renderWithProviders(<ScanLeadDetail leadId="lead_1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^renew$/i }));
    expect(mocks.renewMutate).toHaveBeenCalledTimes(1);
    expect(mocks.renewMutate.mock.calls[0][0]).toBe('lead_1');
  });

  it('shows the correlated outbound prospect with a cross-link', () => {
    renderWithProviders(<ScanLeadDetail leadId="lead_1" onBack={vi.fn()} />);
    expect(screen.getByText(/also an outbound prospect/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /view sales lead/i });
    expect(link).toHaveAttribute('href', '/leads?lead=99');
  });

  it('omits the correlated card when there is no match', () => {
    mocks.useScanLead.mockReturnValue({
      data: { ...detail, correlated_sales_lead: null },
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<ScanLeadDetail leadId="lead_1" onBack={vi.fn()} />);
    expect(screen.queryByText(/also an outbound prospect/i)).not.toBeInTheDocument();
  });
});
