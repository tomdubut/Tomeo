export function calcDropdownPos(rect: DOMRect, dropdownWidth: number, dropdownHeight: number) {
  const spaceBelow = window.innerHeight - rect.bottom
  const openUpward = spaceBelow < dropdownHeight
  const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8)
  return {
    top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
    left: Math.max(8, left),
  }
}
