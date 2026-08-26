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
});
