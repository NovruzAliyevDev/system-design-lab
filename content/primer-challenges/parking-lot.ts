// The parking lot, from the primer's object-oriented design solution (`parking_lot.py`): a ParkingLot of
// Levels, each a row of ParkingSpots of a size, parks a Vehicle on the first Level with room. A
// Motorcycle, Car or Bus each knows which spot it fits in; a Bus takes five large spots in a row.
//
// Rules find the lot, the levels, the spots and the vehicle base by their role rather than by name: the
// lot is the class with levels, a level the class with spots, a spot the class that parks a vehicle and
// knows whether one fits, the base the abstract class (or interface) of a vehicle. The three vehicle types
// are found by name, since the question names them. The reference UML mirrors the Python solution's
// classes, its VehicleSize Enum as an enumeration whose fields are its values, and draws the levels, spots
// and parked vehicles as relations only, leaving out a spot's link back to its level.
import type { ChallengeInput } from '../../src/core/challenges/challenge'
import type { ClassSelector, RelationPredicate } from '../../src/core/challenges/rules'
import { ABSTRACT, anyClass, anyMember, anyRelation, anyRelationEitherWay, MANY_OR_SOME, umlClass, umlDesign, umlRelation } from './shared'

/** Whether a vehicle fits in a spot. */
const FIT_METHOD = 'can_?fit.*|fits.*'
/** The lot: by its name or by its levels. */
const LOT: ClassSelector[] = [{ name: '(parking_?)?(lot|garage)' }, { fields: ['(num_?)?(levels|floors)|(level|floor)_?count'] }]
/** A level: by its name or by counting its spots. */
const LEVEL: ClassSelector[] = [{ name: '(parking_?)?(level|floor|storey)' }, { fields: ['.*spots'] }]
/** A spot: by its name or by parking a vehicle that fits. */
const SPOT: ClassSelector[] = [{ name: '(parking_?)?(spot|space|slot|bay)' }, { methods: [FIT_METHOD, 'park.*'] }]
/** What every type of vehicle is: an abstract class or interface, by its name or by knowing where it fits. */
const VEHICLE_BASE: ClassSelector[] = [
  { name: '(abstract_?)?vehicle', kind: ABSTRACT },
  { kind: ABSTRACT, methods: [FIT_METHOD] },
]
/** The three types, by the names the question gives them. */
const VEHICLE_TYPES: ClassSelector[] = [{ name: 'motor_?(cycle|bike)|bike' }, { name: '(compact_?)?car' }, { name: 'bus' }]
/** A vehicle of any type. */
const VEHICLES = [...VEHICLE_BASE, ...VEHICLE_TYPES]
/** How a vehicle and the spots it is parked on know each other. */
const PARKS: RelationPredicate['kind'] = ['association', 'aggregation']

export const parkingLot: ChallengeInput = {
  id: 'parking-lot',
  title: 'Parking lot dizayn edin',
  kind: 'ood',
  source: 'primer',
  codeSolutionId: 'parking_lot',
  lessonIds: ['object-oriented-design-interview-questions-with-solutions'],
  stages: [
    {
      id: 'class-design',
      type: 'class-design',
      weight: 1,
      prompt:
        'Avtomobilləri boş yerlərə yerləşdirən çoxmərtəbəli parking lot-un siniflərini qurun. Primer-in fərziyyələri: nəqliyyat növləri motorcycle, car və bus-dır; hər növ fərqli sayda yer tutur. Motorcycle yerinə yalnız motorcycle, compact yerə motorcycle və car, large yerə motorcycle və car sığır; bus ardıcıl 5 large yer boş olanda park edə bilir. Parking lot-un bir neçə mərtəbəsi (level) var. Sinifləri sahələri (field) və metodları ilə əlavə edin, aralarındakı əlaqələri (relation) növü və multiplicity ilə çəkin.',
      rules: [
        {
          id: 'lot-levels',
          weight: 2,
          description: 'Parking lot mərtəbələrdən ibarətdir: ParkingLot-dan Level-ə composition və ya aggregation, Level tərəfdə çoxluq (* və ya 1..*).',
          hints: [
            'Parking lot hansı hissələrdən ibarətdir?',
            'ParkingLot və Level sinifləri əlavə edin, ParkingLot-dan Level-ə composition çəkin və Level ucuna * multiplicity verin.',
            'Primer-də ParkingLot num_levels sayda Level-i levels siyahısında saxlayır: mərtəbə parking lot-un hissəsidir və onsuz yaşamır, ona görə bu, composition-dur. ParkingLot tərəfdə 1, Level tərəfdə 1..* (bir neçə mərtəbə).',
          ],
          check: anyRelation(LOT, LEVEL, { kind: ['composition', 'aggregation'], toMultiplicity: MANY_OR_SOME }),
        },
        {
          id: 'level-spots',
          weight: 2,
          description: 'Hər mərtəbə park yerlərindən ibarətdir: Level-dən ParkingSpot-a composition və ya aggregation, ParkingSpot tərəfdə çoxluq (*).',
          hints: [
            'Mərtəbədə avtomobil konkret olaraq harada dayanır?',
            'ParkingSpot sinfi əlavə edin, Level-dən ona composition çəkin və ParkingSpot ucuna * multiplicity verin.',
            'Primer-də Level spots siyahısında ParkingSpot-ları saxlayır və available_spots ilə boş yerləri sayır. Yer mərtəbənin hissəsidir, ona görə composition-dur: Level tərəfdə 1, ParkingSpot tərəfdə *.',
          ],
          check: anyRelation(LEVEL, SPOT, { kind: ['composition', 'aggregation'], toMultiplicity: MANY_OR_SOME }),
        },
        {
          id: 'park',
          weight: 2,
          description: 'Parking lot avtomobili park edir (park_vehicle).',
          hints: [
            'Sürücü parking lot-a gələndə hansı əməliyyat çağırılır?',
            'ParkingLot sinfinə avtomobili qəbul edib boş yerə qoyan metod əlavə edin.',
            'Primer-də ParkingLot.park_vehicle(vehicle) mərtəbələri bir-bir yoxlayır və Level.park_vehicle-ı çağırır; Level avtomobilin sığdığı boş yeri tapır və onu ParkingSpot-a qoyur. Yer yoxdursa, False qaytarır.',
          ],
          check: anyMember(LOT, { method: 'park.*' }),
        },
        {
          id: 'vehicle-base',
          weight: 2,
          description: 'Bütün nəqliyyat növləri üçün abstrakt Vehicle sinfi var.',
          hints: [
            'Motorcycle, car və bus-ın ortaq nəyi var?',
            'Ortaq abstrakt Vehicle sinfi əlavə edin (növü: abstract): nömrə nişanı, ölçü və tutduğu yerlərlə.',
            'Primer-də Vehicle abstrakt sinifdir: vehicle_size, license_plate, spot_size sahələri və take_spot, clear_spots metodları hamı üçün eynidir, can_fit_in_spot isə abstraktdır.',
          ],
          check: anyClass(VEHICLE_BASE),
        },
        {
          id: 'vehicle-types',
          weight: 2,
          description: 'Motorcycle, Car və Bus Vehicle-dan törəyir.',
          hints: [
            'Üç nəqliyyat növünün hər biri hansı mənada Vehicle-dır?',
            'Motorcycle, Car və Bus siniflərini əlavə edin və hər birindən Vehicle-a inheritance çəkin (Vehicle tərəfdə boş üçbucaq).',
            'Primer-də Motorcycle, Car və Bus Vehicle-ın alt sinifləridir: hər biri öz ölçüsü və tutduğu yer sayı ilə yaranır (bus 5 yer) və can_fit_in_spot-u öz qaydası ilə yazır.',
          ],
          check: { type: 'all-of', predicates: VEHICLE_TYPES.map((type) => anyRelation([type], VEHICLE_BASE, { kind: ['inheritance', 'implementation'] })) },
        },
        {
          id: 'fits',
          weight: 2,
          description: 'Vehicle hansı yerə sığdığını özü bilir (can_fit_in_spot).',
          hints: [
            'Car-ın motorcycle yerinə sığmadığını if-lərlə hər yerdə yoxlamamaq üçün bu bilgini harada saxlamaq olar?',
            'Vehicle sinfinə yerin ona uyğun olub-olmadığını qaytaran abstrakt metod əlavə edin.',
            'Primer-də can_fit_in_spot(spot) Vehicle-da abstraktdır: Motorcycle hər yerə, Car compact və large yerə, Bus yalnız large yerə sığır. ParkingSpot.can_fit_vehicle əvvəlcə yerin boş olduğunu yoxlayır, sonra onu çağırır, ona görə yeni nəqliyyat növü əlavə etmək yeri dəyişmir.',
          ],
          check: anyMember(VEHICLE_BASE, { method: FIT_METHOD }),
        },
        {
          id: 'spot-holds-one',
          weight: 1,
          description: 'Bir yerdə ən çox bir avtomobil dayanır: Vehicle ilə ParkingSpot arasında association və ya aggregation, Vehicle tərəfdə 0..1.',
          hints: [
            'Bir park yerində eyni anda neçə avtomobil ola bilər?',
            'Vehicle-dan ParkingSpot-a association çəkin və Vehicle ucuna 0..1 multiplicity verin.',
            'Primer-də ParkingSpot-un vehicle sahəsi var: boş yerdə None, dolu yerdə bir Vehicle. Ona görə yer tərəfdən baxanda avtomobil 0..1-dir.',
          ],
          check: anyRelationEitherWay(SPOT, VEHICLES, PARKS, '0..1'),
        },
        {
          id: 'vehicle-takes-spots',
          weight: 2,
          description: 'Avtomobil bir neçə yer tuta bilər (bus 5 yer): Vehicle ilə ParkingSpot arasında association və ya aggregation, ParkingSpot tərəfdə çoxluq (*).',
          hints: [
            'Bus park edəndə neçə yer tutur və avtomobil çıxanda hansı yerlər boşalmalıdır?',
            'Vehicle-dan ParkingSpot-a association-un ParkingSpot ucuna * multiplicity verin.',
            'Primer-də Vehicle-ın spots_taken siyahısı var: take_spot yeri ona əlavə edir, clear_spots çıxanda hamısını boşaldır. Motorcycle və car bir yer tutur, bus ardıcıl 5 large yer, ona görə ParkingSpot tərəfdə *.',
          ],
          check: anyRelationEitherWay(VEHICLES, SPOT, PARKS, MANY_OR_SOME),
        },
        {
          id: 'size-enum',
          weight: 1,
          description: 'Ölçülər enum-dur: MOTORCYCLE, COMPACT, LARGE.',
          hints: [
            'Yerin və avtomobilin ölçüsü hansı dəyərləri ala bilər?',
            'Növü enum olan bir VehicleSize sinfi əlavə edin və üç ölçünü onun sahələri kimi yazın.',
            'Primer-də VehicleSize Enum-dur: MOTORCYCLE, COMPACT, LARGE. Həm Vehicle, həm ParkingSpot ölçünü bu dəyərlərlə saxlayır, ona görə avtomobilin yerə sığdığını müqayisə etmək asandır.',
          ],
          check: { type: 'class', class: { kind: 'enum', fields: ['motor_?(cycle|bike)|small', 'compact|medium|regular', 'large|big'] } },
        },
      ],
      referenceSolution: umlDesign(
        [
          umlClass('class-1', 'ParkingLot', 0, 0, ['num_levels: int'], ['park_vehicle(vehicle)']),
          umlClass('class-2', 'Level', 420, 0, ['SPOTS_PER_ROW = 10', 'floor: int', 'num_spots: int', 'available_spots: int'], ['spot_freed()', 'park_vehicle(vehicle)', '_find_available_spot(vehicle)', '_park_starting_at_spot(spot, vehicle)']),
          umlClass('class-3', 'ParkingSpot', 840, 0, ['row: int', 'spot_number: int', 'spot_size: int', 'vehicle_size: VehicleSize'], ['is_available()', 'can_fit_vehicle(vehicle)', 'park_vehicle(vehicle)', 'remove_vehicle()']),
          umlClass('class-4', 'Vehicle', 420, 400, ['vehicle_size: VehicleSize', 'license_plate', 'spot_size: int'], ['clear_spots()', 'take_spot(spot)', 'can_fit_in_spot(spot)'], 'abstract'),
          umlClass('class-5', 'Motorcycle', 0, 280, [], ['can_fit_in_spot(spot)']),
          umlClass('class-6', 'Car', 0, 420, [], ['can_fit_in_spot(spot)']),
          umlClass('class-7', 'Bus', 0, 560, [], ['can_fit_in_spot(spot)']),
          umlClass('class-8', 'VehicleSize', 840, 400, ['MOTORCYCLE', 'COMPACT', 'LARGE'], [], 'enum'),
        ],
        [
          umlRelation('class-1', 'class-2', 'composition', '1', '1..*'),
          umlRelation('class-2', 'class-3', 'composition', '1', '*'),
          // spots_taken and a spot's vehicle: a Vehicle takes one spot or, a Bus, five; a spot holds at most one Vehicle.
          umlRelation('class-4', 'class-3', 'association', '0..1', '*'),
          umlRelation('class-5', 'class-4', 'inheritance'),
          umlRelation('class-6', 'class-4', 'inheritance'),
          umlRelation('class-7', 'class-4', 'inheritance'),
        ],
      ),
    },
  ],
}
