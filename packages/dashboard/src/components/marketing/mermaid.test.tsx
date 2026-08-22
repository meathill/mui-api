// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import mermaid from 'mermaid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Mermaid } from './mermaid';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

describe('Mermaid component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders SVG returned by mermaid', async () => {
    vi.mocked(mermaid.render).mockResolvedValueOnce({
      svg: '<svg data-testid="mermaid-svg"><g></g></svg>',
      bindFunctions: undefined,
      diagramType: 'flowchart',
    });

    const { container } = render(<Mermaid chart="flowchart TD; A-->B;" />);

    await waitFor(() => {
      expect(container.querySelector('svg[data-testid="mermaid-svg"]')).not.toBeNull();
    });
    expect(mermaid.initialize).toHaveBeenCalled();
  });

  it('falls back to code block when render fails', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Syntax error'));

    render(<Mermaid chart="invalid flowchart" />);

    await waitFor(() => {
      expect(screen.getByText('invalid flowchart')).not.toBeNull();
    });
  });
});
