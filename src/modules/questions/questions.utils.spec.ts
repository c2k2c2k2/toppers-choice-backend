import {
  getQuestionLocalizedValue,
  hasMeaningfulQuestionContent,
} from './questions.utils';

describe('questions.utils locale helpers', () => {
  it('does not treat Marathi-only localized content as English content', () => {
    const value = {
      'mr-IN': {
        blocks: [{ type: 'paragraph', text: 'फक्त मराठी प्रश्न' }],
      },
    };

    expect(
      hasMeaningfulQuestionContent(getQuestionLocalizedValue(value, 'mr')),
    ).toBe(true);
    expect(
      hasMeaningfulQuestionContent(getQuestionLocalizedValue(value, 'en')),
    ).toBe(false);
  });

  it('returns direct structured content when the document is not locale-wrapped', () => {
    const value = {
      blocks: [{ type: 'paragraph', text: 'Standalone structured content' }],
    };

    expect(getQuestionLocalizedValue(value, 'en')).toEqual(value);
    expect(getQuestionLocalizedValue(value, 'mr')).toEqual(value);
  });
});
