import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from './en'
import { zhTW } from './zh-TW'
import { catalogs, detectLanguage, isLanguage, LANGUAGE_STORAGE_KEY, UserFacingError, userFacingError } from './locale'

afterEach(() => vi.restoreAllMocks())

describe('message catalogs', () => {
  it('provides matching, nonempty entries and stable language self-names', () => {
    expect(catalogs).toEqual({ en, 'zh-TW': zhTW })
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort())
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof zhTW[key], key).toBe(typeof en[key])
      if (typeof en[key] === 'string') {
        expect(en[key], key).not.toBe('')
        expect(zhTW[key], key).not.toBe('')
      }
    }
    for (const messages of Object.values(catalogs)) {
      expect(messages.english).toBe('English')
      expect(messages.traditionalChinese).toBe('繁體中文（台灣）')
    }
    expect(LANGUAGE_STORAGE_KEY).toBe('mathdraw.language')
  })

  it.each([
    {
      language: 'en' as const,
      expected: [
        'Original picture: 我的 picture.png',
        'Original image: width 640 px × height 320 px.',
        'Auto size: 16 columns x 20 rows.',
        'These math settings provide 3 distinct answers, so the color limit is reduced to 2.',
        'Choose larger paper: this worksheet needs at least 250 mm wide x 310 mm tall, including margins. Keep 100% scale to preserve readable cells. Smaller paper may clip the puzzle.',
        'Operands range from 0 to your maximum (2-99).',
        '20 by 16 addition puzzle',
        '20 by 16 math puzzle',
        'Pixel picture with 20 rows, 16 columns and 8 colors',
        'Color 3',
        '16 columns x 20 rows / 1 color',
        '16 columns x 20 rows / 8 colors',
        'Enter a whole number from 4 to 64.',
        'Colors before/after palette processing: 12 → 8. Cells changed by the palette: 23. Cells whitened by background skipping: 7.',
      ],
    },
    {
      language: 'zh-TW' as const,
      expected: [
        '原始圖片：我的 picture.png',
        '原始圖片：寬 640 像素 × 高 320 像素。',
        '自動格數：16 欄 × 20 列。',
        '目前的數學設定可產生 3 種不同答案，因此顏色上限調整為 2 色。',
        '請選擇較大的紙張：含邊界的學習單至少需要寬 250 mm、高 310 mm。請保持 100% 比例，讓格子清楚易讀。紙張太小可能會裁切拼圖。',
        '算式中的數字從 0 到你設定的上限（2～99）。',
        '20 列 16 欄加法拼圖',
        '20 列 16 欄數學拼圖',
        '20 列、16 欄、8 色的像素圖',
        '顏色 3',
        '16 欄 × 20 列 / 1 色',
        '16 欄 × 20 列 / 8 色',
        '請輸入 4～64 的整數。',
        '調色盤處理前／後的顏色數：12 → 8。調色盤變更顏色的格數：23。略過背景而變白的格數：7。',
      ],
    },
  ])('formats dynamic $language messages without losing values or dimension order', ({ language, expected }) => {
    const messages = catalogs[language]
    expect([
      messages.originalPicture('我的 picture.png'),
      messages.imageDimensions(640, 320),
      messages.autoSizeValue(16, 20),
      messages.reducedColors(3, 2),
      messages.largerPaper(250, 310),
      messages.operandHelp(0),
      messages.additionGrid(20, 16),
      messages.mathGrid(20, 16),
      messages.pixelPicture(20, 16, 8),
      messages.colorNumber(3),
      messages.worksheetSize(16, 20, 1),
      messages.worksheetSize(16, 20, 8),
      messages.wholeNumber(4, 64),
      messages.processingSummary(12, 8, 23, 7),
    ]).toEqual(expected)
  })
})

describe('language selection', () => {
  it.each([
    { preferences: ['zh-TW'], expected: 'zh-TW' },
    { preferences: ['zh'], expected: 'zh-TW' },
    { preferences: ['zh-CN'], expected: 'zh-TW' },
    { preferences: ['zh-HK'], expected: 'zh-TW' },
    { preferences: ['zh-Hant-TW'], expected: 'zh-TW' },
    { preferences: ['ZH-hans-CN'], expected: 'zh-TW' },
    { preferences: ['en'], expected: 'en' },
    { preferences: ['en-GB'], expected: 'en' },
    { preferences: ['EN-us'], expected: 'en' },
    { preferences: ['fr-FR', 'zh-TW', 'en-US'], expected: 'zh-TW' },
    { preferences: ['fr-FR', 'en-AU', 'zh-TW'], expected: 'en' },
    { preferences: ['zh-HK', 'en-US'], expected: 'zh-TW' },
    { preferences: ['en-US', 'zh-TW'], expected: 'en' },
    { preferences: ['fr-FR', 'ja-JP'], expected: 'en' },
    { preferences: ['english', 'zhang', ''], expected: 'en' },
    { preferences: [], expected: 'en' },
  ])('uses the first supported preference from $preferences', ({ preferences, expected }) => {
    expect(detectLanguage(Object.freeze(preferences))).toBe(expected)
  })

  it.each(['en', 'zh-TW'])('accepts the explicit catalog identifier %s', value => {
    expect(isLanguage(value)).toBe(true)
  })

  it.each([null, '', 'en-US', 'zh', 'zh-CN', 'zh-tw', 'EN', 'fr-FR', 'undefined'])('rejects invalid stored preference %s', value => {
    expect(isLanguage(value)).toBe(false)
  })
})

describe('user-facing errors', () => {
  it('preserves recognized error codes for translation at render time', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const original = new UserFacingError('decodeFailed')
    const error = userFacingError(original, 'loadFailed')
    expect(error).toBe(original)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('UserFacingError')
    expect(error.code).toBe('decodeFailed')
    expect(error.message).toBe(en.decodeFailed)
    expect(catalogs.en[error.code]).toBe(en.decodeFailed)
    expect(catalogs['zh-TW'][error.code]).toBe(zhTW.decodeFailed)
    expect(log).not.toHaveBeenCalled()
  })

  it.each([new Error('Internal decoder detail'), 'Internal detail', null, undefined, { code: 'decodeFailed' }])('logs an unknown cause and exposes only a translatable fallback', cause => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = userFacingError(cause, 'loadFailed')
    expect(log).toHaveBeenCalledExactlyOnceWith(cause)
    expect(error).toBeInstanceOf(UserFacingError)
    expect(error.code).toBe('loadFailed')
    expect(error.message).toBe(en.loadFailed)
    expect(catalogs['zh-TW'][error.code]).toBe(zhTW.loadFailed)
  })
})
