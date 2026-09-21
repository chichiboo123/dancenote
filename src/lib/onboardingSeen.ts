const STORAGE_KEY = 'dongseon-onboarded'

/** 처음 쓰는 사람에게 보여 줄 그림 안내를 이미 봤는지 */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // 저장소를 못 쓰면 매번 보여 준다. (건너뛰기를 누르면 되니까)
    return false
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // 기억하지 못해도 괜찮다.
  }
}
