import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'
import { isManager } from '@/lib/categories'
import { sql } from '@/lib/db'

// 12 varied test submissions covering all the key scenarios
const TEST_SUBMISSIONS = [
  // --- High-scoring / Priority ---
  {
    member_id: 'TEST001', member_name: 'Alice Fairway', recognition: 'named',
    description: 'Install a GPS-enabled yardage system on all 18 holes with real-time pin positions on shared screens at tees.',
    benefit: 'Members would have accurate yardage information on every shot, speeding up play and improving the experience for golfers of all levels. Comparable clubs have seen pace-of-play improve by 12 minutes per round.',
    category: 'course', impact: 8,
    member_email: 'test-alice@example.com',
  },
  {
    member_id: 'TEST002', member_name: 'Bob Birdie', recognition: 'named',
    description: 'Introduce a Saturday morning beginners\' group with a PGA professional — structured 6-week course for new members.',
    benefit: 'Retention of new members is a known challenge for all golf clubs. A structured introduction programme builds confidence, creates social bonds and reduces early dropout. Directly supports the strategic priority of growing membership.',
    category: 'competitions', impact: 8,
    member_email: 'test-bob@example.com',
  },

  // --- H&S item ---
  {
    member_id: 'TEST003', member_name: 'Carol Green', recognition: 'named',
    description: 'The wooden steps on the path between the 7th green and 8th tee are badly rotted and a serious slip hazard, especially in wet conditions.',
    benefit: 'A member or visitor will be injured if this is not addressed urgently. The steps are used by every single player on every round. This is a health and safety risk that could result in a claim against the club.',
    category: 'grounds', impact: 8,
    member_email: 'test-carol@example.com',
  },

  // --- Quick win candidates ---
  {
    member_id: 'TEST004', member_name: 'David Eagle', recognition: 'named',
    description: 'Add a whiteboard or digital display in the locker room showing today\'s competition starting sheet and results.',
    benefit: 'Members frequently ask at the bar about who is playing and results. A simple display would reduce pressure on staff and keep everyone informed. Very low cost — a whiteboard would suffice as a first step.',
    category: 'clubhouse', impact: 4,
    member_email: 'test-david@example.com',
  },
  {
    member_id: 'TEST005', member_name: 'Emma Putt', recognition: 'anonymous',
    description: 'Provide a basic phone charging station in the bar area — a multi-plug unit on the bar or nearby shelf.',
    benefit: 'Members increasingly rely on phone for GPS and scoring apps during a round. Arriving at the 19th hole with a flat battery is a common frustration. A £30 charging unit would resolve this completely.',
    category: 'bar', impact: 2,
    member_email: 'test-emma@example.com',
  },

  // --- Cluster pair (same issue — shower temperature) ---
  {
    member_id: 'TEST006', member_name: 'Frank Bogey', recognition: 'named',
    description: 'The hot water in the men\'s changing room showers runs out after approximately 4 players have showered. There is rarely adequate hot water after a busy morning.',
    benefit: 'Having a warm shower after a round is a basic expectation at a members\' club. The current situation is embarrassing and reflects poorly on the club\'s facilities. A larger water heater or a booster system would resolve this.',
    category: 'clubhouse', impact: 6,
    member_email: 'test-frank@example.com',
  },
  {
    member_id: 'TEST007', member_name: 'Grace Iron', recognition: 'named',
    description: 'Shower hot water in the changing rooms is completely inadequate. After a Saturday medal we queued to shower and at least half the field had cold showers.',
    benefit: 'This is a persistent and serious quality issue. If we want to attract and retain members, basic facilities must work. I have heard multiple members complain about this. Please fix the hot water system.',
    category: 'clubhouse', impact: 6,
    member_email: 'test-grace@example.com',
  },

  // --- High cost / committee threshold ---
  {
    member_id: 'TEST008', member_name: 'Harry Wedge', recognition: 'named',
    description: 'Completely resurface and expand the car park to add 40 additional spaces and improve drainage, which currently floods the lower section in heavy rain.',
    benefit: 'Car park availability is a genuine barrier to visiting the club on busy days. Members have left because they could not find parking. Flooding means spaces are lost for days after heavy rain. Proper resurfacing would add significant asset value to the club.',
    category: 'grounds', impact: 8,
    member_email: 'test-harry@example.com',
  },

  // --- Active / medium band ---
  {
    member_id: 'TEST009', member_name: 'Isla Driver', recognition: 'named',
    description: 'Introduce a halfway house or drinks trolley service on the course — at minimum a cold drinks and snacks stop at the 9th hole.',
    benefit: 'Most comparable clubs offer some form of on-course catering. Members playing 18 holes have no food or drink option after leaving the clubhouse. A simple kiosk at the 9th would generate revenue and significantly improve the playing experience, especially in summer.',
    category: 'refreshments', impact: 6,
    member_email: 'test-isla@example.com',
  },

  // --- Low priority ---
  {
    member_id: 'TEST010', member_name: 'James Loft', recognition: 'anonymous',
    description: 'Put some motivational golf quotes on the walls of the locker rooms.',
    benefit: 'It would make the changing rooms more interesting and give a sense of the history and culture of golf. Other clubs have done this and it looks nice.',
    category: 'clubhouse', impact: 2,
    member_email: 'test-james@example.com',
  },

  // --- Restaurant / medium ---
  {
    member_id: 'TEST011', member_name: 'Karen Chip', recognition: 'named',
    description: 'Offer a post-round set-price two-course meal deal — £15 to include a main and dessert — available from 12:00–3:00 pm on weekdays.',
    benefit: 'Many members leave after their round without eating at the club. A visible, affordable set price option would encourage members to stay longer and increase food revenue. Weekday lunchtimes are currently very quiet — this would help fill that slot.',
    category: 'restaurant', impact: 4,
    member_email: 'test-karen@example.com',
  },

  // --- Already in plan / strategic ---
  {
    member_id: 'TEST012', member_name: 'Leo Mashie', recognition: 'named',
    description: 'Upgrade the golf course irrigation system to a modern automated system with soil moisture sensors to reduce water usage and improve fairway conditions.',
    benefit: 'Our current irrigation is manual and inefficient. Modern systems pay for themselves within a few years through water savings and reduced greenkeeping labour. Fairway conditions would be more consistent, which members regularly comment on.',
    category: 'course', impact: 8,
    member_email: 'test-leo@example.com',
  },
]

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('bci_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.type !== 'director' || !isManager(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Add test_data column if it doesn't exist
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS test_data BOOLEAN NOT NULL DEFAULT FALSE`

  let inserted = 0
  for (const s of TEST_SUBMISSIONS) {
    await sql`
      INSERT INTO submissions
        (member_id, member_name, recognition, description, benefit, category, impact, member_email, test_data)
      VALUES
        (${s.member_id}, ${s.member_name}, ${s.recognition}, ${s.description}, ${s.benefit},
         ${s.category}, ${s.impact}, ${s.member_email}, TRUE)
    `
    inserted++
  }

  return NextResponse.json({ ok: true, inserted })
}
