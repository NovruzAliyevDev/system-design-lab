// The call center, from the primer's object-oriented design solution (`call_center.py`): a CallCenter
// dispatches each Call to the first free Operator, then Supervisor, then Director, and queues it when
// nobody is free. The three ranks are Employees, which take, complete and escalate their one Call.
//
// Rules find the call center, the employee base and the call by their role rather than by name: the call
// center is the class that dispatches calls, the base the abstract class (or interface) that escalates
// them, the call the class with a state and a rank. The three ranks are found by name, since the question
// names them. The reference UML mirrors the Python solution's classes, its Enums as enumerations whose
// fields are their values. Its queue of calls stays a field, the structure the dispatching is built on;
// the other links to objects are drawn as relations only, leaving out an Employee's link back to its
// call center.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { ClassSelector } from '../../src/core/challenges/rules'
import { ABSTRACT, anyClass, anyMember, anyRelation, anyRelationEitherWay, MANY_OR_SOME, umlClass, umlDesign, umlRelation } from './shared'

/** The class that hands each call to an employee. */
const CENTER: ClassSelector = { methods: ['(dispatch|route|assign).*'] }
/** What every rank of employee is: an abstract class or interface, by its name or by escalating calls. */
const EMPLOYEE_BASE: ClassSelector[] = [
  { name: 'employee|staff|worker|agent', kind: ABSTRACT },
  { kind: ABSTRACT, methods: ['escalate.*'] },
]
/** The three ranks, lowest first, by the names the question gives them. */
const RANKS: ClassSelector[] = [{ name: 'operator|respondent|fresher' }, { name: 'supervisor|manager|lead' }, { name: 'director' }]
/** A call: its state and the rank of employee it needs. */
const CALL: ClassSelector = { fields: ['state|status', 'rank|level|priority'] }
/** An employee of any rank. */
const EMPLOYEES = [...EMPLOYEE_BASE, ...RANKS]

export const callCenter: ChallengeInput = {
  id: 'call-center',
  title: 'Call center dizayn edin',
  kind: 'ood',
  source: 'primer',
  codeSolutionId: 'call_center',
  lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
  stages: [
    {
      id: 'class-design',
      type: 'class-design',
      weight: 1,
      prompt:
        'Zəngləri işçilərə paylayan call center-in siniflərini qurun. İşçilərin üç səviyyəsi var: operator, supervisor və director. Primer-in fərziyyələri: ilk zəngi həmişə operator alır; boş operator yoxdursa və ya operator zəngi həll edə bilmirsə, zəng supervisor-a, ondan da director-a keçir; director istənilən zəngi həll edir; heç kim boş deyilsə, zəng növbəyə düşür; VIP zənglər yoxdur, girişlər düzgündür. Sinifləri sahələri (field) və metodları ilə əlavə edin, aralarındakı əlaqələri (relation) növü və multiplicity ilə çəkin.',
      rules: [
        {
          id: 'dispatcher',
          weight: 2,
          description: 'Bir sinif call center-in özüdür: gələn zəngi boş işçiyə paylayır (dispatch_call).',
          hints: [
            'Yeni zəng gələndə onu hansı işçiyə verəcəyinə kim qərar verir?',
            'Bir sinfə zəngi qəbul edib uyğun boş işçiyə verən metod əlavə edin.',
            'Primer-də CallCenter-in dispatch_call(call) metodu zəngin səviyyəsindən başlayaraq əvvəl operator-lara, sonra supervisor-lara, sonra director-lara baxır və ilk boş işçiyə verir.',
          ],
          check: { type: 'class', class: CENTER },
        },
        {
          id: 'employee-base',
          weight: 2,
          description: 'Bütün işçilər üçün abstrakt Employee sinfi var.',
          hints: [
            'Operator, supervisor və director-un ortaq nəyi var?',
            'Zəngi qəbul edən, bitirən və yuxarı ötürən ortaq abstrakt Employee sinfi əlavə edin (növü: abstract).',
            'Primer-də Employee abstrakt sinifdir: employee_id, name, rank sahələri və take_call, complete_call metodları hamı üçün eynidir, escalate_call isə abstraktdır, hər səviyyə onu özü yazır.',
          ],
          check: anyClass(EMPLOYEE_BASE),
        },
        {
          id: 'ranks',
          weight: 2,
          description: 'Operator, Supervisor və Director Employee-dən törəyir.',
          hints: [
            'Üç səviyyənin hər biri hansı mənada Employee-dir?',
            'Operator, Supervisor və Director siniflərini əlavə edin və hər birindən Employee-yə inheritance çəkin (Employee tərəfdə boş üçbucaq).',
            'Primer-də Operator, Supervisor və Director Employee-nin alt sinifləridir: ortaq davranışı miras alır, yalnız escalate_call-u fərqli yazırlar. CallCenter onları eyni cür idarə edir, çünki hamısı Employee-dir.',
          ],
          check: {
            type: 'all-of',
            predicates: RANKS.map((rank) => anyRelation([rank], EMPLOYEE_BASE, { kind: ['inheritance', 'implementation'] })),
          },
        },
        {
          id: 'escalate',
          weight: 2,
          description: 'Employee zəngi yuxarı səviyyəyə ötürə bilir (escalate_call).',
          hints: [
            'Operator zəngi həll edə bilməyəndə nə baş verir?',
            'Employee sinfinə zəngi bir səviyyə yuxarı ötürən metod əlavə edin.',
            'Primer-də escalate_call Employee-də abstraktdır: Operator zəngin səviyyəsini SUPERVISOR, Supervisor DIRECTOR edir, zəngi buraxır və notify_call_escalated ilə CallCenter-ə xəbər verir (primer bu metodu boş saxlayır; onun işi zəngi yeni səviyyədə paylamaqdır). Director zəngi ötürə bilməz, çünki o, istənilən zəngi həll edir.',
          ],
          check: anyMember(EMPLOYEE_BASE, { method: 'escalate.*' }),
        },
        {
          id: 'call',
          weight: 2,
          description: 'Zəng ayrıca Call sinfidir: vəziyyətini (state) və ona lazım olan səviyyəni (rank) bilir.',
          hints: [
            'Zəng haqqında nəyi bilmək lazımdır ki, onu düzgün işçiyə verəsən və gedişini izləyəsən?',
            'Vəziyyət və səviyyə sahələri olan bir Call sinfi əlavə edin.',
            'Primer-də Call state (READY, IN_PROGRESS, COMPLETE) və rank sahələrini saxlayır: rank zəngi hansı səviyyədən paylamağa başlamağı, state isə onun gözlədiyini, danışıldığını və ya bitdiyini göstərir.',
          ],
          check: { type: 'class', class: CALL },
        },
        {
          id: 'call-queue',
          weight: 2,
          description: 'Heç kim boş deyilsə, call center zəngi növbəyə qoyur.',
          hints: [
            'Bütün işçilər məşğul olanda yeni zəng hara gedir?',
            'Call center sinfinə gözləyən zənglərin növbəsini saxlayan sahə əlavə edin.',
            'Primer-də CallCenter-in queued_calls sahəsi deque-dir: dispatch_call heç bir boş işçi tapmasa, zəngi növbənin sonuna əlavə edir. İşçi boşalanda növbənin əvvəlindəki zəng ona verilməlidir (FIFO): primer bunun üçün dispatch_queued_call_to_newly_freed_employee metodunu boş saxlayır.',
          ],
          check: { type: 'member', class: CENTER, field: '.*(queue|waiting|pending|hold).*' },
        },
        {
          id: 'center-employees',
          weight: 2,
          description: 'Call center çox işçi saxlayır: call center-dən işçilərə aggregation və ya composition, işçi tərəfdə çoxluq (*).',
          hints: [
            'Call center hansı işçilər arasında seçim edir?',
            'Call center-dən işçi siniflərinə (və ya Employee-yə) aggregation çəkin və işçi ucuna * multiplicity verin.',
            'Primer-də CallCenter operators, supervisors və directors siyahıları ilə yaradılır: işçilər ondan kənarda yaranır və ona verilir, ona görə bu, aggregation-dur. Call center tərəfdə 1, işçi tərəfdə * (çox).',
          ],
          check: anyRelation([CENTER], EMPLOYEES, { kind: ['aggregation', 'composition'], toMultiplicity: MANY_OR_SOME }),
        },
        {
          id: 'employee-call',
          weight: 1,
          description: 'Hər işçi eyni anda ən çox bir zəngə baxır: işçi ilə Call arasında association və ya aggregation, Call tərəfdə 0..1.',
          hints: [
            'Bir işçi eyni anda neçə zənglə danışa bilər?',
            'Employee-dən Call-a association çəkin və Call ucuna 0..1 multiplicity verin.',
            'Primer-də Employee-nin call sahəsi var: boş işçidə None, danışanda bir Call. Call da öz employee-sini bilir. Ona görə işçi ilə zəng arasında association var, hər iki tərəfdə 0..1.',
          ],
          check: anyRelationEitherWay(EMPLOYEES, [CALL], ['association', 'aggregation'], '0..1'),
        },
        {
          id: 'rank-enum',
          weight: 1,
          description: 'Səviyyələr enum-dur: OPERATOR, SUPERVISOR, DIRECTOR.',
          hints: [
            'Zəngin və işçinin səviyyəsi hansı dəyərləri ala bilər?',
            'Növü enum olan bir Rank sinfi əlavə edin və üç səviyyəni onun sahələri kimi yazın.',
            'Primer-də Rank Enum-dur: OPERATOR = 0, SUPERVISOR = 1, DIRECTOR = 2. Həm Employee, həm Call rank: Rank sahəsini saxlayır; sabit dəyərlər siyahısı səhv səviyyə yazmağa imkan vermir və sıra escalation-u göstərir.',
          ],
          check: { type: 'class', class: { kind: 'enum', fields: ['operator|respondent|fresher', 'supervisor|manager|lead', 'director'] } },
        },
      ],
      referenceSolution: umlDesign(
        [
          umlClass('class-1', 'CallCenter', 0, 220, ['queued_calls: deque'], ['dispatch_call(call)', '_dispatch_call(call, employees)', 'notify_call_escalated(call)', 'notify_call_completed(call)', 'dispatch_queued_call_to_newly_freed_employee(call, employee)']),
          umlClass('class-2', 'Employee', 840, 180, ['employee_id', 'name', 'rank: Rank'], ['take_call(call)', 'complete_call()', 'escalate_call()', '_escalate_call()'], 'abstract'),
          umlClass('class-3', 'Operator', 420, 0, [], ['escalate_call()']),
          umlClass('class-4', 'Supervisor', 420, 220, [], ['escalate_call()']),
          umlClass('class-5', 'Director', 420, 440, [], ['escalate_call()']),
          umlClass('class-6', 'Call', 1260, 200, ['state: CallState', 'rank: Rank'], []),
          umlClass('class-7', 'Rank', 840, 480, ['OPERATOR', 'SUPERVISOR', 'DIRECTOR'], [], 'enum'),
          umlClass('class-8', 'CallState', 1260, 420, ['READY', 'IN_PROGRESS', 'COMPLETE'], [], 'enum'),
        ],
        [
          umlRelation('class-3', 'class-2', 'inheritance'),
          umlRelation('class-4', 'class-2', 'inheritance'),
          umlRelation('class-5', 'class-2', 'inheritance'),
          umlRelation('class-1', 'class-3', 'aggregation', '1', '*'),
          umlRelation('class-1', 'class-4', 'aggregation', '1', '*'),
          umlRelation('class-1', 'class-5', 'aggregation', '1', '*'),
          // call and employee: an Employee talks on at most one Call, and a Call with at most one Employee.
          umlRelation('class-2', 'class-6', 'association', '0..1', '0..1'),
          // queued_calls: the Calls waiting for a free Employee.
          umlRelation('class-1', 'class-6', 'aggregation', '0..1', '*'),
        ],
      ),
    },
  ],
}
