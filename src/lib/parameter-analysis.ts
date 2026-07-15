export type ParameterAnalysisMatchItem = {
  record_id: string
  part_revision_id: string | null
}

export function buildParameterAnalysisMatchKey(
  recordId: string,
  partRevisionId: string,
  paramAId: string,
  paramBId: string,
) {
  return [recordId, partRevisionId, paramAId, paramBId].join(':')
}

export function pairParameterAnalysisItems<
  ItemA extends ParameterAnalysisMatchItem,
  ItemB extends ParameterAnalysisMatchItem,
>(
  itemsA: readonly ItemA[],
  itemsB: readonly ItemB[],
  paramAId: string,
  paramBId: string,
) {
  const itemsByKey = new Map<string, ItemA>()

  for (const itemA of itemsA) {
    if (!itemA.part_revision_id) continue
    itemsByKey.set(
      buildParameterAnalysisMatchKey(
        itemA.record_id,
        itemA.part_revision_id,
        paramAId,
        paramBId,
      ),
      itemA,
    )
  }

  const pairs: Array<{ itemA: ItemA; itemB: ItemB }> = []
  for (const itemB of itemsB) {
    if (!itemB.part_revision_id) continue
    const itemA = itemsByKey.get(
      buildParameterAnalysisMatchKey(
        itemB.record_id,
        itemB.part_revision_id,
        paramAId,
        paramBId,
      ),
    )
    if (itemA) pairs.push({ itemA, itemB })
  }

  return pairs
}
