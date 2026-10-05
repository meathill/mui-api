import { buildLlmsTxt, createLlmsTxtResponse } from '@/lib/llms-txt';

export const dynamic = 'force-static';

export function GET() {
  return createLlmsTxtResponse(buildLlmsTxt());
}
