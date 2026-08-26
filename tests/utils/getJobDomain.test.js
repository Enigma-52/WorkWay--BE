import { describe, it, expect } from 'vitest';
import { getJobDomain } from '../../src/utils/helper.js';

// Regression coverage for the taxonomy fix: bare " account " was swallowing
// sales titles into Accounts / Finance, and the generic " engineer " catch-all
// had no discipline qualifier. See workway-worker/TAXONOMY_FIX.md for the
// measured impact this was traced from (real titles from production).
describe('getJobDomain', () => {
  it('routes "account executive/manager" sales titles to Customer Acquisition, not Accounts / Finance', async () => {
    expect(await getJobDomain('Account Executive, Mid City')).toBe('Customer Acquisition');
    expect(await getJobDomain('Sr Account Executive')).toBe('Customer Acquisition');
    expect(await getJobDomain('Account Executive, Enterprise')).toBe('Customer Acquisition');
    expect(await getJobDomain('Account Manager')).toBe('Customer Acquisition');
    expect(await getJobDomain('Mid-Market Account Manager')).toBe('Customer Acquisition');
    expect(await getJobDomain('Enterprise Account Executive, West')).toBe('Customer Acquisition');
    expect(await getJobDomain('Account Coordinator, Travel & Hospitality')).toBe('Customer Acquisition');
  });

  it('still routes real finance/accounting titles to Accounts / Finance', async () => {
    expect(await getJobDomain('Corporate Controller')).toBe('Accounts / Finance');
    expect(await getJobDomain('Senior Accountant, Intercompany and Consolidations')).toBe('Accounts / Finance');
    expect(await getJobDomain('Financial Systems Manager')).toBe('Accounts / Finance');
    expect(await getJobDomain('Strategic Finance Senior Analyst')).toBe('Accounts / Finance');
    expect(await getJobDomain('Accounts Payable Specialist')).toBe('Accounts / Finance');
  });

  it('routes non-software professional engineering disciplines to Other, not Software Engineering', async () => {
    expect(await getJobDomain('Mechanical Engineer, Aviation Integration (Starlink)')).toBe('Other');
    expect(await getJobDomain('Mechanical Engineer')).toBe('Other');
    expect(await getJobDomain('High Power Electrical Engineer II')).toBe('Other');
  });

  it('routes non-software engineering disciplines to Other even when the title also contains "design"', async () => {
    expect(await getJobDomain('Mechanical Design Engineer II')).toBe('Other');
    expect(await getJobDomain('Design Engineer III - Water Resources')).toBe('Other');
  });

  it('still routes real software engineering titles to Software Engineering', async () => {
    expect(await getJobDomain('Senior Software Engineer (Python), Mortgage')).toBe('Software Engineering');
    expect(await getJobDomain('Staff Engineer - Payments')).toBe('Software Engineering');
  });

  it('still routes real product design titles to Design / Creative', async () => {
    expect(await getJobDomain('Product Designer, Link')).toBe('Design / Creative');
    expect(await getJobDomain('Graphic Designer')).toBe('Design / Creative');
  });

  it('routes broader "account ___" sales titles (director/supervisor/management) to Customer Acquisition', async () => {
    expect(await getJobDomain('Account Director')).toBe('Customer Acquisition');
    expect(await getJobDomain('Account Supervisor')).toBe('Customer Acquisition');
    expect(await getJobDomain('Account Development Representative')).toBe('Customer Acquisition');
    expect(await getJobDomain('Manager, Account Management')).toBe('Customer Acquisition');
    expect(await getJobDomain('Key Account Director')).toBe('Customer Acquisition');
  });

  it('does not misclassify "Solutions Engineer" serving an industry vertical as that industry\'s engineering discipline', async () => {
    expect(await getJobDomain('Senior Solutions Engineer, Aerospace & Defense')).toBe('Software Engineering');
  });

  it('routes "developer" titles to Software Engineering (was not a keyword anywhere before)', async () => {
    expect(await getJobDomain('Software Developer')).toBe('Software Engineering');
    expect(await getJobDomain('Salesforce Developer')).toBe('Software Engineering');
  });

  it('routes corporate IT titles to Operations, but IT-audit titles to Legal', async () => {
    expect(await getJobDomain('IT Manager')).toBe('Operations');
    expect(await getJobDomain('IT Systems Administrator')).toBe('Operations');
    expect(await getJobDomain('Senior IT Auditor')).toBe('Legal');
    expect(await getJobDomain('Director, IT Audit and Technology Risk Advisory')).toBe('Legal');
  });

  it('routes Implementation Manager/Consultant to Support / Customer Success', async () => {
    expect(await getJobDomain('Implementation Manager')).toBe('Support / Customer Success');
    expect(await getJobDomain('Director, Customer Implementation')).toBe('Support / Customer Success');
  });

  it('routes procurement/logistics/facilities cluster to Operations', async () => {
    expect(await getJobDomain('Procurement Manager')).toBe('Operations');
    expect(await getJobDomain('Logistics Coordinator')).toBe('Operations');
    expect(await getJobDomain('Facilities Manager')).toBe('Operations');
  });

  it('routes remaining healthcare-adjacent titles to Healthcare', async () => {
    expect(await getJobDomain('Caregiver')).toBe('Healthcare');
    expect(await getJobDomain('Endodontist Opening')).toBe('Healthcare');
    expect(await getJobDomain('Psychiatric Clinician')).toBe('Healthcare');
  });

  // Regression coverage for block-ordering bugs found while backfilling
  // production: adding broader keywords to Operations/Skilled Trades
  // without checking precedence caused more specific Legal and Healthcare
  // titles to be caught by generic Operations/Skilled Trades terms first.
  it('routes Legal-flavored "operations"/"contracts" titles to Legal, not Operations', async () => {
    expect(await getJobDomain('Legal Operations Manager')).toBe('Legal');
    expect(await getJobDomain('Legal Operations Specialist')).toBe('Legal');
    expect(await getJobDomain('Commercial Paralegal - Contracts Manager')).toBe('Legal');
    expect(await getJobDomain('Operations Paralegal')).toBe('Legal');
  });

  it('routes IT-audit titles to Legal, not Operations', async () => {
    expect(await getJobDomain('Senior IT Auditor')).toBe('Legal');
    expect(await getJobDomain('Director, IT Audit and Technology Risk Advisory')).toBe('Legal');
  });

  it('routes "Facilities"/"Logistics" technician-level roles to Skilled Trades, not Operations', async () => {
    expect(await getJobDomain('Facilities Technician')).toBe('Skilled Trades');
    expect(await getJobDomain('Logistics Technician')).toBe('Skilled Trades');
  });

  it('routes Behavior Technician titles (including "Behavior Health Technician" and plural "Technicians") to Healthcare, not Skilled Trades', async () => {
    expect(await getJobDomain('Behavior Technician')).toBe('Healthcare');
    expect(await getJobDomain('Behavior Health Technician I')).toBe('Healthcare');
    expect(await getJobDomain('Registered Behavior Technicians Aspiring to Complete their BCBA')).toBe('Healthcare');
    // must not over-broaden to unrelated "behavior" titles without "technician"
    expect(await getJobDomain('Consumer Behavior Analyst')).toBe('Analyst');
  });
});
