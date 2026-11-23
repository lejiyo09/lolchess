/* Decision Training — graded scenarios (multiple reasonable answers, opportunity cost) + data-driven situation generator */
'use strict';
(function (TL) {
  const V = {};
  let mode = 'bank', catF = 'all';
  const D = () => TL.state.drill;
  const SCORE_LABEL = { 3: '최선 계열', 2: '합리적', 1: '상황 의존·위험', 0: '비추천' };
  // Numbers in explanations follow data/game-rules.json: Set 19 PBE tables (stage damage 2/6/7/10/12/17, 150 at 8+, XP L7→8 60, L8→9 68,
  // 1-1 = Opening Encounter, no 1-1 carousel) + Set 18 carryover for interest 1/10G max 5 and streak 3-4:+1 5:+2 6+:+3.
  const Q = [
    { id: 'e1', cat: '경제', s: { r: '2-5', hp: 82, gold: 28, lv: 4, streak: -3 }, q: '보드가 약해 3연패 중. 이번 라운드 계획 단계에서 무엇을 할까?', key: ['30G 이자 구간', '연패 보너스(4~5연패)', '2스테이지 피해가 작음'],
      o: [
        { t: '남은 골드를 거의 다 써서 롤다운하고 연패를 끊는다', s: 0, w: '2스테이지 패배 피해는 기본 2 + 생존 유닛 수라 작아. 지금 롤다운은 1~2코스트 업그레이드 정도로 효율이 낮고 이자(2G)와 연패 보너스를 동시에 버려.', c: '이자 2G/라운드 + 연패 보너스 손실' },
        { t: '불필요한 유닛 1~2장을 팔아 30G를 맞추고 연패를 유지한다', s: 3, w: '30G면 이자 3G. 연패가 4~5로 이어지면 +1~2G가 추가돼. 3-2 전후 큰 지출을 위한 골드를 가장 많이 모으는 선택.', c: '체력 몇 칸(2스테이지는 저렴)' },
        { t: '28G를 그대로 들고 다음 라운드로 넘어간다', s: 2, w: '나쁘지 않지만 2G 차이로 이자 1G를 놓쳐. 팔 수 있는 유닛이 없다면 이 선택도 합리적.', c: '이자 1G' },
        { t: 'XP를 사서 5레벨로 올려 다음 전투를 이기려 한다', s: 1, w: '보드가 약해 1명 추가로 이기기 어렵다면 연패·이자 모두 손해. 보드가 아슬아슬하게 지는 상황이었다면 고려 가능.', c: '이자 구간 하락 + 연패 단절 위험' },
      ], p: '연패 운영은 "피해가 싼 구간에서 골드를 최대화"하는 전략이야. 언제 끊을지(보통 3스테이지 초중반)를 미리 정해 둬.' },
    { id: 'e2', cat: '경제', s: { r: '3-3', hp: 74, gold: 49, lv: 6, streak: 0 }, q: '상점에 내 조합의 2코스트 유닛이 나와서 사면 2성이 완성돼. 사면 47G가 돼.', key: ['이자 1G 손실은 1라운드분', '2성 완성 가치', '의식적 거래'],
      o: [
        { t: '산다 — 2성 완성은 전투력 상승이 크고 이자 손실은 1G', s: 3, w: '49→47G는 다음 라운드 이자가 5→4G가 될 뿐(1G). 2성 완성으로 이기거나 체력을 아끼면 충분히 회수돼.', c: '다음 라운드 이자 1G' },
        { t: '안 산다 — 50G 이자가 무조건 우선', s: 1, w: '이자 원칙을 기계적으로 적용한 선택. 그 유닛이 다시 나오지 않으면 더 큰 골드를 쓰게 될 수 있어.', c: '2성 지연 → 패배 피해/추가 리롤' },
        { t: '사고, 다음 라운드에 쓸모없는 유닛을 팔아 50G를 회복한다', s: 3, w: '판매가로 이자 구간을 즉시 복구할 수 있으면 손실은 사실상 0에 가까워.', c: '거의 없음' },
        { t: '상점을 잠그고 다음 라운드에 50G 이상이 되면 산다', s: 2, w: '잠금은 합리적이지만 이번 전투는 2성 없이 치러. 체력 여유가 있으면 가능한 선택.', c: '이번 전투력' },
      ], p: '이자는 "10G 구간마다 라운드당 1G"라는 가격표야. 손해를 정확히 계산하고 의식적으로 거래해.' },
    { id: 'l1', cat: '레벨', s: { r: '3-5', hp: 64, gold: 48, lv: 6, xp: '20/36', streak: 1 }, q: '6레벨 20/36 XP, 48G. 7레벨을 언제 갈까?', key: ['레벨업 후 30G 이상 유지', '7레벨 3·4코스트 확률', '3-7 대안'],
      o: [
        { t: '지금 XP 4번(16G) → 7레벨, 32G 유지', s: 3, w: '16 XP = 4회 구매 = 16G. 레벨업 후 32G로 이자 3G 유지. "레벨업 후 30G 이상(패배 중이면 40G)이면 3-5" 가이드와 일치.', c: '이자 1~2G' },
        { t: '3-7까지 기다렸다가 패시브 XP와 함께 7레벨', s: 2, w: '골드를 더 아낄 수 있지만 3-5·3-6 전투를 6레벨로 치러. 연승 중이거나 보드가 강하면 합리적.', c: '2라운드 동안 유닛 1명 부족' },
        { t: '6레벨에서 30G까지 리롤', s: 1, w: '2코스트 리롤 조합이면 가능한 선택. 아니라면 6레벨에서 4코스트 확률이 5%라 효율이 낮아.', c: '레벨 지연 + 이자' },
        { t: '7레벨 후 0G까지 롤다운', s: 0, w: '체력 64면 아직 여유가 있어. 4-1/4-2 8레벨 롤다운용 골드를 미리 써 버리게 돼.', c: '중반 경제 붕괴' },
      ], p: '레벨 타이밍은 "레벨업 후 남는 골드"로 판단하면 일관성이 생겨.' },
    { id: 'l2', cat: '레벨', s: { r: '4-1', hp: 58, gold: 52, lv: 7, xp: '30/60', streak: -1 }, q: '7레벨 30/60, 52G. 4코스트 캐리 조합. 이번 라운드?', key: ['8레벨 4코스트 확률 급등', '레벨업 비용 32G', '리롤 하한선'],
      o: [
        { t: '8레벨(30XP → 8회, 32G) 후 남은 20G 중 일부로 롤', s: 3, w: '8레벨은 4코스트 확률이 크게 오르는 구간. 체력 58이면 하한선을 정해(예: 10G) 롤다운하는 표준 플레이.', c: '이자 대부분' },
        { t: '8레벨만 올리고 20G 보존, 4-2에 롤다운', s: 2, w: '보드가 버틴다면 4-2 증강을 보고 롤다운하는 것도 합리적.', c: '4-1 전투에서 2성 업그레이드 지연' },
        { t: '7레벨에서 52G 전부 롤다운', s: 1, w: '3코스트 리롤 조합이면 최선. 4코스트 캐리라면 7레벨 4코스트 확률이 낮아 비효율.', c: '8레벨 지연' },
        { t: '아무것도 안 하고 60G 이상 저축', s: 0, w: '체력 58, 연패 중에 4스테이지 패배는 12~15 피해(기본 7 + 생존 유닛). 이자 상한(5G)을 넘는 골드는 추가 수익이 없어.', c: '체력 + 템포' },
      ], p: '4-1/4-2는 대부분의 4코스트 조합이 8레벨로 전환하는 표준 구간이야.' },
    { id: 'h1', cat: '체력', s: { r: '4-1', hp: 35, gold: 50, lv: 7, xp: '0/60', streak: -2 }, q: '체력 35, 50G, 7레벨. 무엇을 해야 할까? (조합에 따라 답이 달라짐)', key: ['남은 패배 가능 횟수', '조합 코스트대', '이자보다 생존'],
      o: [
        { t: '(4코스트 조합) 8레벨은 60G가 필요해 불가 → 7레벨에서 2성 탱커/캐리 확보용 롤다운', s: 3, w: '4스테이지 패배는 7 + 생존 유닛 수 ≈ 12~15. 체력 35면 2번 정도 버텨. 지금 보드를 올려야 해.', c: '8레벨 지연' },
        { t: '(3코스트 리롤 조합) 7레벨에서 3성/2성 목표로 롤다운', s: 3, w: '7레벨은 3코스트 확률이 가장 높은 구간(데이터 기준 43%). 리롤 조합의 표준 롤다운 시점.', c: '이자 전부' },
        { t: '50G 유지하며 이자 받기', s: 0, w: '두 번 더 지면 탈락권. 미래 이자보다 현재 생존 가치가 훨씬 커.', c: '탈락 위험' },
        { t: 'XP를 사서 레벨만 올림', s: 1, w: '60XP가 필요해 50G로는 8레벨이 안 돼. 골드만 줄고 보드는 그대로.', c: '골드 낭비' },
      ], p: '"몇 번 더 질 수 있나?"를 먼저 계산하고, 2번 이하면 경제보다 안정화가 우선.' },
    { id: 's1', cat: '연속', s: { r: '2-6', hp: 66, gold: 41, lv: 5, streak: -5 }, q: '5연패 중. 다음 라운드(2-7)는 PvE. 지금 롤다운으로 연패를 끊을까?', key: ['6연패 = +3G', 'PvE에서도 연속 보너스 지급', '3스테이지 진입 계획'],
      o: [
        { t: '연패 유지 — 6연패로 +3G, 2-7 PvE에서도 보너스 지급', s: 3, w: '연속 보너스는 PvE 라운드에도 지급되고 연속 기록은 유지돼. 3-1 이후 끊을 계획을 세워.', c: '체력 약간' },
        { t: '롤다운해 지금 이기기', s: 1, w: '연패 6에서 끊으면 +3G/라운드 수입이 사라져. 체력이 이미 낮다면 고려.', c: '라운드당 3G' },
        { t: '50G를 만들기 위해 유닛 판매', s: 2, w: '이자 구간을 올리는 건 좋지만 보드를 너무 약하게 하면 피해가 커질 수 있어.', c: '체력' },
        { t: '레벨 6으로 올려 승리 시도', s: 1, w: '연패를 끊을 만큼 강해지지 않으면 골드만 쓰고 연패도 유지되는 애매한 결과.', c: '이자 + 애매함' },
      ], p: '연패를 끊는 시점은 "보드를 한 번에 강하게 만들 수 있을 때"로 정하는 게 좋아.' },
    { id: 's2', cat: '연속', s: { r: '3-1', hp: 92, gold: 36, lv: 5, streak: 4 }, q: '4연승 중이지만 다음 상대들이 점점 강해지고 있어. 이번 라운드?', key: ['5연승 +2G, 6연승 +3G', '체력 보존', '레벨업 비용'],
      o: [
        { t: '6레벨로 올려(필요 XP만큼) 연승 유지 시도', s: 3, w: '연승은 골드와 체력을 동시에 지켜. 레벨업으로 승률을 올리는 건 연승 유지의 표준 방법.', c: '이자 구간 하락 가능' },
        { t: '36G를 지키며 그대로 싸움', s: 2, w: '보드가 충분히 강하면 합리적. 지면 연승이 끊기지만 체력 92라 피해는 크지 않아.', c: '연승 보너스 위험' },
        { t: '20G까지 리롤해 2성 만들기', s: 1, w: '레벨업보다 효율이 낮을 수 있어. 페어가 많다면 가능한 선택.', c: '이자 1~2G' },
        { t: '일부러 져서 이자 모으기', s: 0, w: '연승 4는 이미 +1G를 받고 있어. 체력과 보너스를 모두 버려.', c: '체력 + 보너스' },
      ], p: '연승 중에는 "조금 써서 계속 이기기"가 보통 이득이야.' },
    { id: 'p1', cat: '풀', s: { r: '4-2', hp: 48, gold: 44, lv: 8, streak: 0 }, q: '4코스트 캐리 X를 1장 보유. 정찰해 보니 다른 2명이 X를 각각 3장씩 보유. (Set 19 PBE 기준 4코스트 풀 10장)', key: ['남은 장수 = 10 − 6 − 1 = 3', '2성에 2장 필요', '대체 캐리'],
      o: [
        { t: 'X 2성을 위해 계속 롤다운', s: 1, w: '풀에 3장 남았고 2장이 필요해. 불가능은 아니지만 같은 4코스트 다른 챔피언들 사이에서 3장을 찾는 데 큰 골드가 들어.', c: '골드 대량 소모 + 실패 위험' },
        { t: '같은 아이템/특성을 쓰는 덜 경쟁된 캐리로 전환', s: 3, w: '경쟁이 적은 캐리는 풀이 가득 차 있어 2성 확률이 훨씬 높아. 아이템 호환성을 확인해.', c: 'X 관련 투자' },
        { t: '롤다운을 멈추고 9레벨/5코스트 방향으로 저축', s: 2, w: '체력 48이면 시간이 조금 있어. 보드가 버틴다면 합리적.', c: '중간 구간 체력' },
        { t: '그냥 보드 유지, 아무것도 안 함', s: 0, w: '체력 48에서 약한 보드 유지는 위험해.', c: '체력' },
      ], p: '정찰한 장수로 "남은 풀 = 전체 − 보이는 장수 − 내 장수"를 계산하는 습관을 들여.' },
    { id: 'i1', cat: '아이템', s: { r: '2-1', hp: 100, gold: 8, lv: 3, streak: 0 }, q: '재료: B.F. 대검 2, 여신의 눈물 1, 쇠사슬 조끼 1. 최종 캐리는 미정.', key: ['템포 vs 유연성', '범용 아이템', '재료 보존'],
      o: [
        { t: '범용성이 높은 완성 아이템 1~2개를 지금 조합해 초반 보드 강화', s: 3, w: '초반 템포는 연승/체력으로 이어져. 여러 캐리에 쓸 수 있는 아이템을 고르면 전환 위험이 작아.', c: '최종 캐리 최적화 일부' },
        { t: '최종 캐리가 정해질 때까지 재료 전부 보존', s: 1, w: '유연하지만 2스테이지를 약하게 보내 체력/골드 손해. 연패 운영 계획이 확실할 때만 고려.', c: '초반 템포' },
        { t: '방어 아이템(쇠사슬 조끼 조합)을 전방 유닛에 우선', s: 2, w: '탱커 아이템은 캐리가 바뀌어도 대부분 유지돼서 실용적.', c: '공격 템포' },
        { t: '가장 비싼 유닛에 아무 조합이나 장착', s: 0, w: '비싼 유닛이 최종 캐리라는 보장이 없고, 조합 선택에 근거가 없어.', c: '재료 낭비' },
      ], p: '아이템은 "지금의 템포"와 "나중의 최적화" 사이의 거래야.' },
    { id: 'a1', cat: '증강', s: { r: '2-1', hp: 100, gold: 10, lv: 4, streak: 1 }, q: '빠른 8레벨 계획. 선택지: (1) 골드/이자 계열 경제 증강 (2) 즉시 팀 스탯 전투 증강 (3) 재료 아이템 증강', key: ['2-1 경제 가치 최대', '체력 100 = 시간 여유', '계획 일치'],
      o: [
        { t: '(1) 경제 증강', s: 3, w: '2-1은 경제 증강이 가장 오래 이득을 주는 시점이고, 체력 100이라 템포 손해를 감당할 수 있어. 빠른 8레벨 계획과 일치.', c: '초반 전투력' },
        { t: '(3) 아이템 증강', s: 3, w: '아이템은 어떤 조합에도 유용하고 초반 템포도 줘. 경제 증강이 약한 수치라면 이쪽이 더 나을 수 있어.', c: '경제 이득' },
        { t: '(2) 전투 증강', s: 1, w: '연승 운영이라면 가능하지만, 2-1에서는 장기 가치가 상대적으로 작을 수 있어.', c: '장기 가치' },
      ], p: '같은 증강도 시점과 체력에 따라 가치가 달라 — 증강 연구실에서 상황 값을 바꿔 비교해 봐.' },
    { id: 'a2', cat: '증강', s: { r: '4-2', hp: 30, gold: 32, lv: 8, streak: -2 }, q: '체력 30. 선택지: (1) 이자 계열 경제 증강 (2) 즉시 전투력 증강 (3) 장기 성장형(라운드마다 누적) 증강', key: ['남은 라운드 적음', '즉시 효과', '생존'],
      o: [
        { t: '(2) 즉시 전투력', s: 3, w: '체력 30이면 5스테이지 패배 2번이 치명적이야. 지금 이기게 해 주는 증강이 가장 가치 있어.', c: '장기 이득' },
        { t: '(3) 장기 성장형', s: 1, w: '누적될 시간이 부족할 가능성이 커.', c: '현재 전투력' },
        { t: '(1) 경제 증강', s: 0, w: '남은 라운드가 적어 회수 기간이 짧아.', c: '생존' },
      ], p: '증강 가치 = 효과 × 남은 시간. 체력이 낮으면 시간이 줄어든다고 생각해.' },
    { id: 'pos1', cat: '배치', s: { r: '4-5', hp: 52, gold: 30, lv: 8, streak: 0 }, q: '상대 보드에 암살자(후방 진입) 2명. 내 원거리 캐리는 4행 오른쪽 구석에 혼자 있어.', key: ['후방 진입 경로', '미끼/보호', '구석 고립'],
      o: [
        { t: '캐리를 4행 안쪽으로 옮기고 구석에 미끼(저가 유닛/탱커) 배치', s: 3, w: '진입 유닛이 처음 닿는 위치를 미끼로 받게 하고, 캐리는 탱커 인접 칸에 두는 일반적 대응.', c: '캐리 사거리 일부' },
        { t: '캐리를 3행 안쪽으로 당기기', s: 2, w: '후방 진입 1차 타깃을 피할 수 있지만 상대 전방 스킬에 노출될 수 있어.', c: '전방 노출' },
        { t: '그대로 둔다', s: 0, w: '고립된 구석 캐리는 진입 유닛에게 가장 쉬운 타깃이야.', c: '캐리 즉사 위험' },
        { t: '캐리를 1행으로 올린다', s: 0, w: '원거리 캐리를 전방에 두면 모든 적에게 먼저 맞아.', c: '캐리 생존' },
      ], p: '정찰 화면에서 "배치안 A/B"를 저장해 위험 점수를 비교해 봐.' },
    { id: 'pos2', cat: '배치', s: { r: '5-2', hp: 44, gold: 24, lv: 8, streak: 0 }, q: '상대 마법사가 아이템 3개로 광역 스킬을 쓰고 있어. 내 유닛 6명이 한쪽에 뭉쳐 있어.', key: ['광역 범위', '1칸 간격', '캐리 주변 밀집'],
      o: [
        { t: '핵심 딜러 주변을 한 칸씩 띄워 분산 배치', s: 3, w: '광역 스킬이 여러 명을 동시에 맞히는 것을 줄여. 탱커 라인은 유지하면서 후열만 분산하는 것이 일반적.', c: '보호막/버프 범위 효과 일부' },
        { t: '그대로 뭉쳐서 버프/회복 효과 극대화', s: 1, w: '인접 버프가 핵심인 조합(예: 인접 효과 특성)이라면 가능. 아니라면 광역에 취약.', c: '광역 피해' },
        { t: '반대편 구석으로 전부 이동', s: 1, w: '상대 진입 방향에 따라 다르지만 뭉침 자체는 그대로야.', c: '근본 해결 아님' },
      ], p: '배치는 상대 보드별로 달라 — 결승권 상대 2~3명에 대한 배치안을 미리 준비해.' },
    { id: 'r1', cat: '리롤', s: { r: '4-2', hp: 62, gold: 60, lv: 8, streak: -1 }, q: '8레벨, 60G, 2성 캐리가 없어 보드가 약해. 얼마나 롤할까?', key: ['남은 패배 횟수 ≈ 4', '하한선 설정', '이자'],
      o: [
        { t: '20~30G까지 롤하고 멈추기', s: 3, w: '체력 62면 4스테이지(기본 7 + 생존 약 5) 기준 5번 정도 버틸 수 있어. 안정화를 시도하면서도 다음 라운드 재시도 여력을 남겨.', c: '이자 2~3G' },
        { t: '0G까지 올인', s: 1, w: '못 찾으면 다음 라운드에 쓸 골드가 없어. 체력이 더 낮을 때의 선택.', c: '경제 전체' },
        { t: '50G까지만(10G) 롤', s: 2, w: '이자는 지키지만 2성 확률이 낮아. 보드가 거의 버틴다면 합리적.', c: '안정화 실패 위험' },
        { t: '롤하지 않음', s: 0, w: '이자 상한(5G)을 넘는 골드는 추가 수익이 없어. 약한 보드로 4~5스테이지를 버티기 어려워.', c: '체력' },
      ], p: '롤다운 전에 "멈출 골드"를 숫자로 정하고 시작해.' },
    { id: 'l3', cat: '레벨', s: { r: '5-1', hp: 55, gold: 60, lv: 8, xp: '10/68', streak: 2 }, q: '2성 탱커 + 2성 캐리로 안정적인 8레벨 보드. 다음은?', key: ['9레벨 비용 58XP≈60G', '5코스트 확률', '안정화 확인'],
      o: [
        { t: '9레벨로 올려 5코스트/추가 특성 확보', s: 3, w: '"2성 탱커와 2성 캐리를 확보하면 9레벨" 가이드와 일치. 9레벨부터 5코스트 확률이 의미 있게 올라가(데이터 기준 15%).', c: '거의 모든 골드' },
        { t: '8레벨에서 3성/추가 2성 롤', s: 1, w: '4코스트 3성은 풀이 작아 비현실적인 경우가 많아.', c: '레벨 지연' },
        { t: '저축 후 5-5에 9레벨', s: 2, w: '보드가 충분히 강하면 이자를 받으며 천천히 올리는 것도 가능.', c: '5스테이지 중반 전투력' },
      ], p: '보드 안정 → 레벨, 불안정 → 롤. 단순하지만 강력한 기준이야.' },
    { id: 'sc1', cat: '정찰', s: { r: '3-5', hp: 70, gold: 46, lv: 7, streak: 0 }, q: '나와 같은 4코스트 캐리를 쓰는 상대가 2명 보여.', key: ['경쟁 수', '대체 경로', '아이템 호환'],
      o: [
        { t: '대체 캐리/전환 경로를 정하고 호환 아이템 위주로 준비', s: 3, w: '같은 4코스트를 3명이 노리면 풀 경쟁이 커져. 지금 대체안을 정해 두면 8레벨 롤다운이 실패해도 손실이 작아.', c: '최적 아이템 일부' },
        { t: '더 빨리 레벨업해서 먼저 가져가기', s: 2, w: '체력과 골드가 충분하면 경쟁에서 앞설 수 있어. 다만 모두가 같은 생각을 할 수 있어.', c: '경제' },
        { t: '그대로 진행, 경쟁은 무시', s: 0, w: '정찰 정보를 버리는 선택.', c: '2성 실패 위험' },
        { t: '즉시 모든 유닛 판매 후 다른 조합', s: 1, w: '너무 이른 전면 전환은 보드 전투력을 크게 낮춰.', c: '체력' },
      ], p: '정찰은 "누가 무엇을 몇 장 들고 있나"를 숫자로 기록할 때 가장 유용해.' },
    { id: 's3', cat: '연속', s: { r: '3-2', hp: 45, gold: 50, lv: 5, streak: -6 }, q: '6연패로 50G를 모았지만 체력이 45야. 3-2에서?', key: ['3스테이지 패배 ≈ 10~13', '연패 종료 시점', '레벨+롤'],
      o: [
        { t: '6레벨 이상으로 올리고 보드를 크게 강화해 연패 종료', s: 3, w: '체력 45면 3~4스테이지 패배 몇 번으로 위험권이야. 모은 골드를 쓰는 시점.', c: '이자 일부' },
        { t: '연패를 더 유지', s: 0, w: '+3G를 위해 10 내외 피해를 계속 받으면 4스테이지에 체력이 바닥나.', c: '체력' },
        { t: '레벨만 올리고 롤은 4-1에', s: 2, w: '보드가 레벨업만으로 충분히 강해진다면 합리적.', c: '3스테이지 승률' },
      ], p: '연패는 "언제 끊을지"가 계획의 절반이야.' },
  ];
  const CATS = ['all', ...new Set(Q.map(q => q.cat))];

  function bankHTML() {
    const d = D(); const list = Q.filter(q => catF === 'all' || q.cat === catF); if (d.idx >= list.length) d.idx = 0;
    const q = list[d.idx]; const ans = d.answers[q.id];
    const st = q.s;
    return `<div class="panel"><div class="row between"><div class="row">${CATS.map(c => `<button class="xs ${catF === c ? 'on' : ''}" data-cat="${c}">${c === 'all' ? '전체' : c}</button>`).join('')}</div><span class="pill">${d.idx + 1} / ${list.length}</span></div>
      <div class="divider"></div>
      <div class="row" style="margin-bottom:6px"><span class="pill purple">${q.cat}</span><span class="pill gold">${st.r}</span><span class="pill">체력 ${st.hp}</span><span class="pill">${st.gold}G</span><span class="pill">Lv${st.lv}${st.xp ? ' · ' + st.xp + ' XP' : ''}</span><span class="pill ${st.streak > 0 ? 'green' : st.streak < 0 ? 'red' : ''}">${st.streak > 0 ? st.streak + '연승' : st.streak < 0 ? -st.streak + '연패' : '연속 없음'}</span></div>
      <p style="font-size:15px;font-weight:700;margin:6px 0">${TL.esc(q.q)}</p>
      ${!ans ? `<textarea id="dReason" rows="2" placeholder="먼저 이유를 적어 봐 (선택 사항이지만 강력 추천): 골드/체력/레벨/보드 관점">${TL.esc(d._draft || '')}</textarea>` : ''}
      ${q.o.map((o, i) => `<button class="choice ${ans ? 's' + o.s : ''} ${ans && ans.choice === i ? 'picked' : ''}" data-ans="${i}" ${ans ? 'disabled' : ''}><b>${'ABCD'[i]}.</b> ${TL.esc(o.t)}${ans ? `<div class="tiny" style="margin-top:4px"><b>${SCORE_LABEL[o.s]} (${o.s}/3)</b> — ${TL.esc(o.w)}<br><span class="dim">기회비용: ${TL.esc(o.c)}</span></div>` : ''}</button>`).join('')}
      ${ans ? `<div class="feedback"><b>${ans.score >= 2 ? '합리적인 판단이야.' : ans.score === 1 ? '상황에 따라 가능하지만 위험이 커.' : '다시 생각해 볼 부분이 있어.'}</b> ${q.o.filter(o => o.s === 3).length > 1 ? '<span class="pill gold">이 문제는 최선 계열 답이 여러 개야</span>' : ''}<br>${TL.esc(q.p)}
        ${ans.reason ? `<div class="tiny" style="margin-top:6px">내 이유: ${TL.esc(ans.reason)}</div>` : ''}
        <div class="tiny" style="margin-top:6px"><b>핵심 근거 자기 점검</b> — 내 이유에 포함됐던 것 체크: ${q.key.map((k, i) => `<label class="row" style="display:inline-flex;margin-right:8px"><input type="checkbox" data-key="${i}" ${ans.keys?.includes(i) ? 'checked' : ''}/> ${TL.esc(k)}</label>`).join('')}</div>
        <div class="row" style="margin-top:6px"><button class="xs" id="dRetry">이 문제 다시 풀기</button></div></div>` : ''}
      <div class="row between" style="margin-top:10px"><button class="sm" id="dPrev" ${d.idx === 0 ? 'disabled' : ''}>← 이전</button><button class="sm primary" id="dNext">${d.idx === list.length - 1 ? '처음으로' : '다음 →'}</button></div></div>`;
  }
  function stats() {
    const d = D(); const ans = Object.entries(d.answers).filter(([k]) => Q.some(q => q.id === k));
    const avg = ans.length ? TL.sum(ans.map(([, a]) => a.score)) / ans.length : 0;
    const byCat = {}; ans.forEach(([k, a]) => { const c = Q.find(q => q.id === k).cat; (byCat[c] = byCat[c] || []).push(a.score); });
    const keysTotal = ans.reduce((s, [k, a]) => s + (a.keys?.length || 0), 0), keysMax = ans.reduce((s, [k]) => s + Q.find(q => q.id === k).key.length, 0);
    return { n: ans.length, avg, byCat, reasonRate: ans.length ? ans.filter(([, a]) => a.reason).length / ans.length : 0, keyRate: keysMax ? keysTotal / keysMax : 0 };
  }
  /* ---------- generator ---------- */
  function genSituation() {
    const E = TL.engine;
    const stage = TL.pick([3, 4, 4, 5]); const round = stage === 3 ? TL.pick([2, 5]) : TL.pick([1, 2, 5]);
    const level = stage === 3 ? TL.pick([5, 6, 7]) : stage === 4 ? TL.pick([7, 8]) : TL.pick([8, 8, 9]);
    const need = E.xpToNext(level); const xp = need ? TL.rand(Math.floor(need * 0.7)) : 0;
    const hp = TL.pick([22, 30, 38, 46, 55, 64, 72, 85]); const gold = TL.pick([24, 32, 40, 48, 50, 56, 64]);
    const cost = level >= 8 ? 4 : level >= 7 ? TL.pick([3, 4]) : TL.pick([2, 3]);
    const cands = TL.data.champs().filter(c => c.cost === cost && !c.unlock); const target = TL.pick(cands);
    const owned = TL.pick([1, 2]); const others = TL.pick([0, 0, 2, 3, 5]);
    return { stage, round, level, xp, hp, gold, target: target.id, owned, others, streak: TL.pick([-3, -1, 0, 1, 3]) };
  }
  function evalSituation(g) {
    const E = TL.engine; const R = TL.data.rules();
    const typicalSurv = { 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 }[g.stage] || 6; const loss = E.stageDamage(g.stage) + typicalSurv;
    const lossesLeft = Math.floor((g.hp - 1) / loss);
    const need = E.xpToNext(g.level); const xpNeed = need ? need - g.xp : null; const lvCost = xpNeed != null ? Math.ceil(xpNeed / (R.xpPerBuy || 4)) * (R.xpBuyCost || 4) : null;
    const c = TL.data.champ(g.target); const want = 3 - g.owned;
    const pNow = E.rolldown({ level: g.level, champId: g.target, need: want, gold: g.gold, otherHeld: g.others, ownedHeld: g.owned, sims: 1500 });
    const canLevel = lvCost != null && lvCost <= g.gold && g.level < (R.maxLevelByXp || 10);
    const pLv = canLevel ? E.rolldown({ level: g.level + 1, champId: g.target, need: want, gold: g.gold - lvCost, otherHeld: g.others, ownedHeld: g.owned, sims: 1500 }) : null;
    const pHalf = E.rolldown({ level: g.level, champId: g.target, need: want, gold: Math.max(0, g.gold - 30), otherHeld: g.others, ownedHeld: g.owned, sims: 1500 });
    const opts = [];
    const urgent = lossesLeft <= 1, safe = lossesLeft >= 4;
    opts.push({ k: 'roll', t: `현재 레벨(${g.level})에서 전부 롤다운`, p: pNow.p });
    if (canLevel) opts.push({ k: 'lvroll', t: `${g.level + 1}레벨(${lvCost}G) 후 남은 ${g.gold - lvCost}G로 롤다운`, p: pLv.p });
    opts.push({ k: 'half', t: `30G를 남기고 ${Math.max(0, g.gold - 30)}G만 롤`, p: pHalf.p });
    opts.push({ k: 'save', t: '롤하지 않고 이자 유지', p: 0 });
    const best = Math.max(...opts.filter(o => o.k !== 'save').map(o => o.p));
    opts.forEach(o => {
      if (o.k === 'save') { o.s = urgent ? 0 : safe && g.gold < 50 ? 2 : 1; o.w = urgent ? `패배 1번이면 탈락권(예상 피해 ${loss}). 저축의 미래 가치가 거의 없어.` : safe ? `약 ${lossesLeft}번 더 질 수 있어. 보드가 버티면 이자를 쌓는 것도 합리적.` : '중간 상황 — 보드 상태에 따라 판단.'; return; }
      const rel = best ? o.p / best : 0;
      o.s = urgent ? (rel >= 0.9 ? 3 : rel >= 0.6 ? 2 : 1) : safe ? (o.k === 'half' ? (rel >= 0.5 ? 3 : 2) : rel >= 0.9 ? 2 : 1) : (rel >= 0.9 ? 3 : rel >= 0.6 ? 2 : 1);
      o.w = `${c.name} ${want}장 확보 확률 ≈ ${(o.p * 100).toFixed(0)}% (몬테카를로)` + (urgent ? ' · 생존이 최우선' : safe ? ' · 체력 여유 → 골드 보존 가치 있음' : '');
    });
    return { loss, lossesLeft, lvCost, xpNeed, opts, c, want, pool: E.poolSize(c.cost) };
  }
  function genHTML() {
    const d = D(); if (!d.gen) d.gen = genSituation(); const g = d.gen; if (!g._ev) { const e = evalSituation(g); g._ev = { ...e, c: undefined, cId: e.c.id }; } const ev = { ...g._ev, c: TL.data.champ(g._ev.cId) || TL.data.champ(g.target) }; if (!ev.c) { d.gen = genSituation(); return genHTML(); } d._ev = ev;
    const ans = d.genAns;
    return `<div class="panel"><h3>상황 생성기 <span class="row">${TL.statusPill('training-model')}<button class="sm primary" id="gNew">새 상황</button></span></h3>
      <div class="tiny" style="margin-bottom:6px">실제 데이터(상점 확률·풀 크기·XP 표·스테이지 피해)로 계산한 확률을 근거로 평가해. 같은 코스트의 다른 챔피언 풀은 가득 찬 것으로 가정.</div>
      <div class="row" style="margin-bottom:6px"><span class="pill gold">${g.stage}-${g.round}</span><span class="pill">체력 ${g.hp}</span><span class="pill">${g.gold}G</span><span class="pill">Lv${g.level}${ev.xpNeed != null ? ` · 다음 레벨까지 ${ev.xpNeed}XP(${ev.lvCost}G)` : ''}</span><span class="pill">${g.streak > 0 ? g.streak + '연승' : g.streak < 0 ? -g.streak + '연패' : '연속 없음'}</span></div>
      <p style="font-weight:700">목표: <span class="cost-${ev.c.cost}" style="color:var(--cc)">${TL.esc(ev.c.name)} (${ev.c.cost}코스트)</span> 2성 — 보유 ${g.owned}장, 다른 플레이어 ${g.others}장 보유 (풀 ${ev.pool ?? '?'}장). 무엇을 할까?</p>
      <div class="tiny">예상 패배 피해 ≈ ${ev.loss} (기본 ${TL.engine.stageDamage(g.stage)} + 생존 유닛 추정) → 약 <b>${ev.lossesLeft}</b>번 더 질 수 있음</div>
      ${ev.opts.map((o, i) => `<button class="choice ${ans != null ? 's' + o.s : ''} ${ans === i ? 'picked' : ''}" data-gans="${i}" ${ans != null ? 'disabled' : ''}><b>${'ABCD'[i]}.</b> ${TL.esc(o.t)}${ans != null ? `<div class="tiny"><b>${SCORE_LABEL[o.s]}</b> — ${TL.esc(o.w)}</div>` : ''}</button>`).join('')}
      ${ans != null ? `<div class="feedback tiny">확률은 상점 확률(Lv별 코스트 비율) × 풀에 남은 목표 장수 비율로 슬롯마다 계산했어. 실제 판단에는 보드 강도, 아이템, 남은 상대 수도 함께 고려해.</div>` : ''}</div>
      <div class="panel" style="margin-top:12px"><h3>생성기 기록</h3>${(d.genHistory || []).slice(0, 12).map(h => `<div class="tiny">${TL.fmtDate(h.date)} · ${h.r} HP${h.hp} ${h.gold}G Lv${h.lv} → <b>${TL.esc(h.pick)}</b> (${SCORE_LABEL[h.s]})</div>`).join('') || '<div class="tiny">기록 없음</div>'}</div>`;
  }
  function render() {
    const el = TL.$('#view-drill'); const st = stats();
    el.innerHTML = `<div class="view-head"><div><h2>Decision Training <span class="muted small">판단력 훈련</span></h2><p>정답 하나를 맞히는 퀴즈가 아니라, 선택지마다 합리성(0~3)과 기회비용을 평가해. 최선 계열 답이 여러 개인 문제도 있어.</p></div></div>
    <div class="split">
      <div>
        <div class="tabs-mini"><button data-mode="bank" class="${mode === 'bank' ? 'active' : ''}">상황 문제 (${Q.length})</button><button data-mode="gen" class="${mode === 'gen' ? 'active' : ''}">상황 생성기 (데이터 기반)</button></div>
        <div id="dBody">${mode === 'bank' ? bankHTML() : genHTML()}</div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><h3>훈련 결과</h3><div class="kpis"><div class="kpi"><span>푼 문제</span><b>${st.n}/${Q.length}</b></div><div class="kpi"><span>평균 판단 점수</span><b class="gold-t">${st.n ? st.avg.toFixed(2) : '-'}</b><small>/3</small></div><div class="kpi"><span>이유 작성률</span><b>${st.n ? Math.round(st.reasonRate * 100) + '%' : '-'}</b></div><div class="kpi"><span>핵심 근거 포함률</span><b>${st.n ? Math.round(st.keyRate * 100) + '%' : '-'}</b></div></div>
          <h4>분야별</h4>${Object.entries(st.byCat).map(([c, a]) => `<div class="row between tiny"><span>${c}</span><span>${(TL.sum(a) / a.length).toFixed(2)} (${a.length})</span></div><div class="bar"><i style="width:${TL.sum(a) / a.length / 3 * 100}%"></i></div>`).join('') || '<div class="tiny">아직 기록 없음</div>'}
          <div class="row" style="margin-top:8px"><button class="xs danger" id="dReset">결과 초기화</button></div></div>
        <div class="panel"><h3>점수 기준</h3>${[3, 2, 1, 0].map(s => `<div class="tiny"><b>${s}</b> ${SCORE_LABEL[s]}</div>`).join('')}<div class="tiny" style="margin-top:6px">해설 수치는 game-rules.json 기준(Set 19 PBE 표: 피해·XP·1-1 조우자 / Set 18 값: 수입·이자·연속 보너스). 데이터만 교체하면 생성기 계산이 자동으로 바뀌어.</div></div>
      </div>
    </div>`;
    bind();
  }
  function bind() {
    const d = D();
    TL.$$('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; render(); });
    TL.$('#dReset').onclick = () => TL.confirm('결과 초기화', '판단력 훈련 답변 기록을 모두 지울까?', () => { d.answers = {}; d.idx = 0; d.genHistory = []; TL.save(); render(); }, '초기화', 'danger');
    if (mode === 'bank') {
      const list = Q.filter(q => catF === 'all' || q.cat === catF); const q = list[d.idx];
      TL.$$('[data-cat]').forEach(b => b.onclick = () => { catF = b.dataset.cat; d.idx = 0; TL.save(); render(); });
      const r = TL.$('#dReason'); if (r) r.oninput = () => { d._draft = r.value; };
      TL.$$('[data-ans]').forEach(b => b.onclick = () => { const i = +b.dataset.ans; d.answers[q.id] = { choice: i, score: q.o[i].s, reason: (TL.$('#dReason')?.value || '').trim(), date: new Date().toISOString(), keys: [] }; d._draft = ''; TL.save(); render(); });
      TL.$$('[data-key]').forEach(b => b.onchange = () => { const a = d.answers[q.id]; const k = +b.dataset.key; a.keys = b.checked ? [...new Set([...(a.keys || []), k])] : (a.keys || []).filter(x => x !== k); TL.save(); render(); });
      const rt = TL.$('#dRetry'); if (rt) rt.onclick = () => { delete d.answers[q.id]; TL.save(); render(); };
      TL.$('#dPrev').onclick = () => { d.idx = Math.max(0, d.idx - 1); TL.save(); render(); };
      TL.$('#dNext').onclick = () => { d.idx = d.idx >= list.length - 1 ? 0 : d.idx + 1; TL.save(); render(); };
    } else {
      TL.$('#gNew').onclick = () => { d.gen = genSituation(); d.genAns = null; TL.save(); render(); };
      TL.$$('[data-gans]').forEach(b => b.onclick = () => { const i = +b.dataset.gans; d.genAns = i; const o = d._ev.opts[i]; d.genHistory = [{ date: new Date().toISOString(), r: `${d.gen.stage}-${d.gen.round}`, hp: d.gen.hp, gold: d.gen.gold, lv: d.gen.level, pick: o.t, s: o.s }, ...(d.genHistory || [])].slice(0, 100); TL.save(); render(); });
    }
  }
  V.render = render; V.questions = Q; V.stats = stats;
  TL.views.drill = V;
})(window.TL);
