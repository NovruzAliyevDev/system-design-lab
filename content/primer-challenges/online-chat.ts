// The online chat, from the primer's object-oriented design solution (`online_chat.py`): a UserService
// adds and removes Users and passes friend requests (AddRequests) between them; Users message each other
// in PrivateChats and GroupChats, both kinds of Chat, which hold the Messages posted to them.
//
// Rules find the user service, users, requests and messages by their role rather than by name: the
// service is the class that adds users and handles friend requests, a user the class with friends, a
// request the class with a status, from whom and to whom, a message the class with text and a time. Chats
// are found by name, since the question names private and group chats. The reference UML mirrors the
// Python solution's classes, its RequestStatus Enum as an enumeration whose fields are its values. Its
// lookups by id stay fields, as in the code, like the LRU cache's lookup; the users, friends and requests
// they index are drawn as relations too, and a User's chats as the Chat → User relation. The lists a Chat
// keeps are drawn as relations only.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { ClassSelector, RelationPredicate } from '../../src/core/challenges/rules'
import { ABSTRACT, anyClass, anyRelation, anyRelationEitherWay, MANY_OR_SOME, umlClass, umlDesign, umlRelation } from './shared'

/** The user service: by its name, or by adding users and passing friend requests. */
const SERVICE: ClassSelector[] = [{ name: 'user_?(service|manager|registry|directory|repository)' }, { methods: ['(add|create|register)_?user', '.*friend_?request.*'] }]
/** A user: by its name or by having friends. */
const USER: ClassSelector[] = [{ name: 'user|person|member|account|profile' }, { fields: ['friends.*'] }]
/** How a chat of any kind is named. */
const CHAT_NAME = '.*(chat|conversation|channel|room|thread)'
/** Any chat, private or group. */
const CHAT: ClassSelector[] = [{ name: CHAT_NAME }]
/** What private and group chats both are. */
const CHAT_BASE: ClassSelector[] = [{ name: CHAT_NAME, kind: ABSTRACT }]
/** A 1-1 chat, by its name. */
const PRIVATE_CHAT: ClassSelector = { name: '.*(private|direct|one_?(to|on)_?one|dm|personal).*' }
/** A group chat, by its name. */
const GROUP_CHAT: ClassSelector = { name: '.*group.*' }
/** A message: by its name, or by its text and when it was sent. */
const MESSAGE: ClassSelector[] = [{ name: '(chat_?)?(message|post)' }, { fields: ['.*(time|date|created|sent).*', 'message|text|content|body'] }]
/** Where a friend request is: unread, read, accepted or rejected. */
const STATUS_FIELD = '.*status|state'
/** A friend request: by its name and status, or by its status, sender and receiver. */
const REQUEST: ClassSelector[] = [{ name: '.*(request|invit(e|ation))', fields: [STATUS_FIELD] }, { fields: [STATUS_FIELD, 'from.*', 'to.*'] }]
/** How users and the chats they are in know each other. */
const TAKES_PART: RelationPredicate['kind'] = ['association', 'aggregation']
/** Making the generic Chat into a kind of chat: subclassing it, or implementing it when it is an interface. */
const EXTENDS: Pick<RelationPredicate, 'kind'> = { kind: ['inheritance', 'implementation'] }

export const onlineChat: ChallengeInput = {
  id: 'online-chat',
  title: 'Online chat dizayn edin',
  kind: 'ood',
  source: 'primer',
  codeSolutionId: 'online_chat',
  lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
  stages: [
    {
      id: 'class-design',
      type: 'class-design',
      weight: 1,
      prompt:
        'Online chat-in siniflərini qurun. Primer bu ssenarilərə fokuslanır: yalnız mətn söhbətləri; istifadəçini əlavə etmək, silmək və yeniləmək; dostluq sorğusu göndərmək, qəbul və rədd etmək, dostu siyahıdan silmək; group chat yaratmaq, ora dostları dəvət etmək və mesaj yazmaq; dostla private (1-1) chat açmaq və mesaj yazmaq. Miqyaslanma hələlik vacib deyil. Sinifləri sahələri (field) və metodları ilə əlavə edin, aralarındakı əlaqələri (relation) növü və multiplicity ilə çəkin.',
      rules: [
        {
          id: 'user-service',
          weight: 2,
          description: 'Bir sinif istifadəçiləri idarə edir: istifadəçi əlavə edir və dostluq sorğularını ötürür.',
          hints: [
            'Yeni istifadəçini kim qeydiyyata alır və bir istifadəçinin sorğusunu digərinə kim çatdırır?',
            'Bir UserService sinfi əlavə edin: istifadəçi əlavə edən və dostluq sorğusunu ötürən metodlarla.',
            'Primer-də UserService users_by_id-də bütün User-ləri saxlayır: add_user, remove_user, add_friend_request, approve_friend_request, reject_friend_request metodları var. Sorğunu iki istifadəçi arasında o ötürür.',
          ],
          check: anyClass(SERVICE),
        },
        {
          id: 'service-users',
          weight: 1,
          description: 'UserService çox User saxlayır: UserService-dən User-ə composition və ya aggregation, User tərəfdə çoxluq (*).',
          hints: [
            'UserService neçə istifadəçini tanıyır və onları kim yaradır?',
            'UserService-dən User sinfinə composition çəkin və User ucuna * multiplicity verin.',
            'Primer-də User-ləri add_user yaradır və remove_user silir, hamısı users_by_id-də (id → User) saxlanır, ona görə composition uyğundur: UserService tərəfdə 1, User tərəfdə *.',
          ],
          check: anyRelation(SERVICE, USER, { kind: ['composition', 'aggregation'], toMultiplicity: MANY_OR_SOME }),
        },
        {
          id: 'friends',
          weight: 2,
          description: 'İstifadəçinin dostları başqa User-lərdir: User-dən User-ə association və ya aggregation, çoxluq (*).',
          hints: [
            'Dost siyahısında kimlər olur?',
            'User-dən User-in özünə association çəkin və uca * multiplicity verin.',
            'Primer-də User-in friends_by_id sahəsi var (dostun id-si → User): istifadəçi istənilən sayda başqa istifadəçi ilə dostdur, yeni istifadəçinin isə heç dostu yoxdur, ona görə User-dən User-ə association, *.',
          ],
          check: anyRelation(USER, USER, { kind: ['association', 'aggregation'], toMultiplicity: '*' }),
        },
        {
          id: 'friend-request',
          weight: 2,
          description: 'Dostluq sorğusu ayrıca sinifdir: kimdən, kimə və statusu.',
          hints: [
            'Sorğu göndəriləndən qəbul və ya rədd olunana qədər onun haqqında nəyi yadda saxlamaq lazımdır?',
            'Göndərənin, alanın və statusun sahələri olan bir sorğu sinfi əlavə edin.',
            'Primer-də AddRequest from_user_id, to_user_id, request_status və timestamp saxlayır. User göndərdiyi və aldığı sorğuları ayrıca saxlayır, qəbul və rədd statusu dəyişir.',
          ],
          check: anyClass(REQUEST),
        },
        {
          id: 'request-status',
          weight: 1,
          description: 'Sorğunun statusu enum-dur: UNREAD, READ, ACCEPTED, REJECTED.',
          hints: [
            'Dostluq sorğusu hansı vəziyyətlərdə ola bilər?',
            'Növü enum olan bir RequestStatus sinfi əlavə edin və vəziyyətləri, ən azı qəbul və rədd olunmanı, onun sahələri kimi yazın.',
            'Primer-də RequestStatus Enum-dur: UNREAD, READ, ACCEPTED, REJECTED. AddRequest request_status: RequestStatus sahəsini saxlayır.',
          ],
          check: { type: 'class', class: { kind: 'enum', fields: ['accepted|approved', 'rejected|declined'] } },
        },
        {
          id: 'chat-types',
          weight: 2,
          description: 'Private və group chat ortaq abstrakt Chat-dan törəyir.',
          hints: [
            '1-1 söhbətlə qrup söhbətinin ortaq nəyi var, fərqi nədir?',
            'Abstrakt Chat sinfi (növü: abstract), PrivateChat və GroupChat sinifləri əlavə edin, hər ikisindən Chat-a inheritance çəkin.',
            'Primer-də Chat abstraktdır: chat_id, users və messages hamı üçündür. PrivateChat iki istifadəçi ilə yaranır, GroupChat-a isə add_user və remove_user ilə üzv əlavə edilib çıxarılır.',
          ],
          check: { type: 'all-of', predicates: [anyRelation([PRIVATE_CHAT], CHAT_BASE, EXTENDS), anyRelation([GROUP_CHAT], CHAT_BASE, EXTENDS)] },
        },
        {
          id: 'chat-messages',
          weight: 2,
          description: 'Söhbət mesajlardan ibarətdir: Chat-dan Message-ə composition və ya aggregation, Message tərəfdə çoxluq (*).',
          hints: [
            'Söhbətə yazılan mətn harada saxlanır və o söhbətsiz mənalıdırmı?',
            'Mətni və vaxtı olan Message sinfi əlavə edin, Chat-dan ona composition çəkin və Message ucuna * multiplicity verin.',
            'Primer-də Message message_id, message və timestamp saxlayır, Chat isə messages siyahısında öz mesajlarını. Mesaj söhbətin hissəsidir, ona görə composition: Chat tərəfdə 1, Message tərəfdə * (yeni söhbətdə heç biri).',
          ],
          check: anyRelation(CHAT, MESSAGE, { kind: ['composition', 'aggregation'], toMultiplicity: '*' }),
        },
        {
          id: 'chat-users',
          weight: 2,
          description: 'Söhbətin iştirakçıları User-lərdir: Chat ilə User arasında aggregation və ya association, User tərəfdə çoxluq (*).',
          hints: [
            'Söhbətdə kimlər iştirak edir və onlar söhbət bitəndən sonra da qalırmı?',
            'Chat-dan User-ə aggregation çəkin və User ucuna * multiplicity verin.',
            'Primer-də Chat users siyahısını saxlayır: private chat-da iki, group chat-da istənilən sayda istifadəçi. İstifadəçilər söhbətdən asılı olmadan yaşayır, ona görə aggregation: Chat tərəfdə *, User tərəfdə *.',
          ],
          check: anyRelationEitherWay(CHAT, USER, TAKES_PART, MANY_OR_SOME),
        },
        {
          id: 'group-members',
          weight: 1,
          description: 'Group chat-a üzv əlavə etmək olur (add_user).',
          hints: [
            'Dostu qrup söhbətinə necə dəvət edirik?',
            'GroupChat sinfinə istifadəçini qrupa əlavə edən metod əlavə edin.',
            'Primer-də GroupChat-ın add_user(user) və remove_user(user) metodları var: qrupun üzvləri dəyişə bilər, private chat-ın isə iki istifadəçisi həmişə eynidir.',
          ],
          check: { type: 'member', class: GROUP_CHAT, method: '(add|invite|join)(_?(user|member|friend)s?)?' },
        },
      ],
      referenceSolution: umlDesign(
        [
          umlClass('class-1', 'UserService', 0, 0, ['users_by_id: dict'], ['add_user(user_id, name, pass_hash)', 'remove_user(user_id)', 'add_friend_request(from_user_id, to_user_id)', 'approve_friend_request(from_user_id, to_user_id)', 'reject_friend_request(from_user_id, to_user_id)']),
          umlClass(
            'class-2',
            'User',
            420,
            0,
            ['user_id', 'name', 'pass_hash', 'friends_by_id: dict', 'friend_ids_to_private_chats: dict', 'group_chats_by_id: dict', 'received_friend_requests_by_friend_id: dict', 'sent_friend_requests_by_friend_id: dict'],
            ['message_user(friend_id, message)', 'message_group(group_id, message)', 'send_friend_request(friend_id)', 'receive_friend_request(friend_id)', 'approve_friend_request(friend_id)', 'reject_friend_request(friend_id)'],
          ),
          umlClass('class-3', 'AddRequest', 840, 0, ['from_user_id', 'to_user_id', 'request_status: RequestStatus', 'timestamp'], []),
          umlClass('class-4', 'RequestStatus', 1260, 0, ['UNREAD', 'READ', 'ACCEPTED', 'REJECTED'], [], 'enum'),
          umlClass('class-5', 'Chat', 420, 460, ['chat_id'], [], 'abstract'),
          umlClass('class-6', 'PrivateChat', 0, 420, [], []),
          umlClass('class-7', 'GroupChat', 0, 560, [], ['add_user(user)', 'remove_user(user)']),
          umlClass('class-8', 'Message', 840, 460, ['message_id', 'message', 'timestamp'], []),
        ],
        [
          umlRelation('class-1', 'class-2', 'composition', '1', '*'),
          // friends_by_id: a User's friends are other Users.
          umlRelation('class-2', 'class-2', 'association', '*', '*'),
          // The friend requests a User sent and received, each between two Users.
          umlRelation('class-2', 'class-3', 'association', undefined, '*'),
          umlRelation('class-6', 'class-5', 'inheritance'),
          umlRelation('class-7', 'class-5', 'inheritance'),
          umlRelation('class-5', 'class-2', 'aggregation', '*', '*'),
          umlRelation('class-5', 'class-8', 'composition', '1', '*'),
        ],
      ),
    },
  ],
}
