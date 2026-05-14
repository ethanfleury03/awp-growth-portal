import { allocateEstimateNumber as allocateCompanyEstimateNumber } from '@/lib/estimates/number';

/** Compatibility wrapper for older callers. Prefer '@/lib/estimates/number'. */
export async function allocateEstimateNumber(
  companyId: string,
  prefix = 'EST',
): Promise<string> {
  return allocateCompanyEstimateNumber(companyId, prefix);
}
