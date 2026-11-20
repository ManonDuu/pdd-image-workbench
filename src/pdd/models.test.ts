import { describe, expect, it } from 'vitest'
import { classifyModels, isImageModelId, pickImageModel, pickPlanningModel } from './models'

describe('model classification', () => {
  const catalog = [
    'gpt-image-2.6-sunburst',
    'gpt-image-2.6',
    'gpt-image-2.5',
    'gpt-6.2-astra',
    'gpt-5.1',
  ]

  it('never recommends the invalid sunburst image model', () => {
    const pick = classifyModels({ data: catalog.map((id) => ({ id })) })
    expect(pick.recommendedPlanning).toBe('gpt-6.2-astra')
    expect(pick.recommendedImage).toBe('gpt-image-2.6')
    expect(pick.imageIds).not.toContain('gpt-image-2.6-sunburst')
    expect(pickPlanningModel(catalog)).toBe('gpt-6.2-astra')
    expect(pickImageModel(catalog)).toBe('gpt-image-2.6')
  })

  it('does not treat chat models as image models or the reverse', () => {
    expect(isImageModelId('gpt-6.2-astra')).toBe(false)
    expect(isImageModelId('gpt-image-2.6')).toBe(true)
    expect(pickPlanningModel(['gpt-image-2.6', 'gpt-image-2.6-sunburst'])).toBeUndefined()
  })

  it('falls back to gpt-image-2.5 when 2.6 is absent', () => {
    expect(pickImageModel(['gpt-image-2.5', 'gpt-image-2.6-sunburst'])).toBe('gpt-image-2.5')
  })
})
