import { PrismaClient, Role, CarStatus, FuelType, Transmission, ReservationStatus, PaymentType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/fr';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Moroccan cities
const moroccanCities = ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Meknès', 'Oujda', 'Kénitra', 'Tétouan'];

// Popular car brands/models in Morocco
const carModels = [
  { brand: 'Dacia', models: ['Logan', 'Sandero', 'Duster', 'Jogger'] },
  { brand: 'Renault', models: ['Clio', 'Symbol', 'Megane', 'Kwid'] },
  { brand: 'Toyota', models: ['Yaris', 'Corolla', 'RAV4', 'Hilux'] },
  { brand: 'Volkswagen', models: ['Polo', 'Golf', 'Passat', 'Tiguan'] },
  { brand: 'Peugeot', models: ['208', '301', '3008', '308'] },
  { brand: 'Hyundai', models: ['i10', 'i20', 'Tucson', 'Santa Fe'] },
  { brand: 'Kia', models: ['Picanto', 'Rio', 'Sportage', 'Sorento'] },
];

const carFeatures = ['Climatisation', 'GPS', 'Bluetooth', 'Caméra de recul', 'Régulateur de vitesse', 'Siège bébé', 'USB', 'Toit ouvrant', 'Jantes alliage', 'ABS'];

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean up existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.client.deleteMany();
  await prisma.car.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agency.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // ── Super Admin ──────────────────────────────
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@rental.ma',
      password: passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✅ Super admin created: ${superAdmin.email}`);

  // ── Agencies ──────────────────────────────────
  const agenciesData = [
    { name: 'Auto Maroc Location', city: 'Casablanca', email: 'contact@automaroc.ma' },
    { name: 'Riad Cars', city: 'Marrakech', email: 'contact@riadcars.ma' },
    { name: 'Tanger Auto', city: 'Tanger', email: 'contact@tangerauto.ma' },
  ];

  const agencies = [];

  for (const agencyData of agenciesData) {
    const agency = await prisma.agency.create({
      data: {
        name: agencyData.name,
        email: agencyData.email,
        phone: `+212 ${faker.phone.number('6## ### ###')}`,
        address: faker.location.streetAddress(),
        city: agencyData.city,
        country: 'Morocco',
        isActive: true,
        plan: faker.helpers.arrayElement(['basic', 'pro', 'enterprise']),
      },
    });

    // Agency admin
    await prisma.user.create({
      data: {
        email: `manager@${agency.name.toLowerCase().replace(/\s+/g, '')}.ma`,
        password: passwordHash,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: Role.AGENCY_ADMIN,
        agencyId: agency.id,
        isActive: true,
      },
    });

    // Employee
    await prisma.user.create({
      data: {
        email: `employee@${agency.name.toLowerCase().replace(/\s+/g, '')}.ma`,
        password: passwordHash,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: Role.EMPLOYEE,
        agencyId: agency.id,
        isActive: true,
      },
    });

    // Accountant
    await prisma.user.create({
      data: {
        email: `accountant@${agency.name.toLowerCase().replace(/\s+/g, '')}.ma`,
        password: passwordHash,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: Role.ACCOUNTANT,
        agencyId: agency.id,
        isActive: true,
      },
    });

    agencies.push(agency);
    console.log(`✅ Agency created: ${agency.name}`);
  }

  // ── Cars ──────────────────────────────────────
  const cars = [];

  for (const agency of agencies) {
    for (let i = 0; i < 15; i++) {
      const carBrand = faker.helpers.arrayElement(carModels);
      const carModel = faker.helpers.arrayElement(carBrand.models);
      const pricePerDay = faker.number.float({ min: 200, max: 1200, multipleOf: 50 });
      const selectedFeatures = faker.helpers.arrayElements(carFeatures, { min: 2, max: 6 });

      const car = await prisma.car.create({
        data: {
          agencyId: agency.id,
          brand: carBrand.brand,
          model: carModel,
          year: faker.number.int({ min: 2018, max: 2024 }),
          licensePlate: `${faker.number.int({ min: 10000, max: 99999 }})-${faker.helpers.arrayElement(['A', 'B', 'C', 'D', 'H', 'W'])}-${faker.number.int({ min: 10, max: 99 })}`,
          color: faker.helpers.arrayElement(['Blanc', 'Noir', 'Gris', 'Bleu', 'Rouge', 'Argent']),
          fuelType: faker.helpers.arrayElement([FuelType.GASOLINE, FuelType.DIESEL, FuelType.HYBRID]),
          transmission: faker.helpers.arrayElement([Transmission.MANUAL, Transmission.AUTOMATIC]),
          seats: faker.helpers.arrayElement([5, 5, 5, 7, 9]),
          doors: faker.helpers.arrayElement([4, 4, 5]),
          pricePerDay: pricePerDay,
          weeklyDiscount: faker.number.float({ min: 5, max: 15, multipleOf: 5 }),
          monthlyDiscount: faker.number.float({ min: 15, max: 25, multipleOf: 5 }),
          deposit: pricePerDay * 3,
          status: faker.helpers.arrayElement([
            CarStatus.AVAILABLE, CarStatus.AVAILABLE, CarStatus.AVAILABLE,
            CarStatus.RENTED, CarStatus.MAINTENANCE,
          ]),
          mileage: faker.number.int({ min: 5000, max: 150000 }),
          features: selectedFeatures,
          lastMaintenance: faker.date.past({ years: 1 }),
          nextMaintenance: faker.date.future({ years: 1 }),
          insuranceExpiry: faker.date.future({ years: 1 }),
          technicalExpiry: faker.date.future({ years: 2 }),
          isActive: true,
        },
      });
      cars.push({ ...car, agencyId: agency.id });
    }
    console.log(`✅ Cars created for: ${agency.name}`);
  }

  // ── Clients ───────────────────────────────────
  const clients = [];

  for (const agency of agencies) {
    for (let i = 0; i < 20; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      const client = await prisma.client.create({
        data: {
          agencyId: agency.id,
          firstName,
          lastName,
          email: faker.internet.email({ firstName, lastName }),
          phone: `+212 ${faker.phone.number('6## ### ###')}`,
          cin: `${faker.helpers.arrayElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'])}${faker.number.int({ min: 100000, max: 999999 })}`,
          address: faker.location.streetAddress(),
          city: faker.helpers.arrayElement(moroccanCities),
          nationality: 'Moroccan',
          licenseNumber: `${faker.helpers.arrayElement(['C', 'D'])}${faker.number.int({ min: 100000, max: 999999 })}`,
          licenseExpiry: faker.date.future({ years: 5 }),
          licenseCountry: 'Morocco',
          riskScore: faker.number.int({ min: 0, max: 30 }),
          totalRentals: faker.number.int({ min: 0, max: 20 }),
          totalSpent: faker.number.float({ min: 0, max: 50000, multipleOf: 100 }),
          isActive: true,
        },
      });
      clients.push({ ...client, agencyId: agency.id });
    }
    console.log(`✅ Clients created for: ${agency.name}`);
  }

  // ── Reservations & Payments ───────────────────
  let reservationCounter = 1;

  for (const agency of agencies) {
    const agencyCars = cars.filter((c) => c.agencyId === agency.id);
    const agencyClients = clients.filter((c) => c.agencyId === agency.id);

    for (let i = 0; i < 25; i++) {
      const car = faker.helpers.arrayElement(agencyCars);
      const client = faker.helpers.arrayElement(agencyClients);

      const startDate = faker.date.between({
        from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      const totalDays = faker.number.int({ min: 1, max: 14 });
      const endDate = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

      const pricePerDay = Number(car.pricePerDay);
      const subtotal = pricePerDay * totalDays;
      const discountPercent = totalDays >= 30 ? Number(car.monthlyDiscount) : totalDays >= 7 ? Number(car.weeklyDiscount) : 0;
      const discountAmount = (subtotal * discountPercent) / 100;
      const totalAmount = subtotal - discountAmount;
      const depositAmount = Number(car.deposit);

      const isCompleted = endDate < new Date();
      const status = isCompleted
        ? ReservationStatus.COMPLETED
        : startDate <= new Date()
          ? ReservationStatus.ACTIVE
          : faker.helpers.arrayElement([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]);

      const reservation = await prisma.reservation.create({
        data: {
          reservationNumber: `REF-${new Date().getFullYear()}-${String(reservationCounter++).padStart(4, '0')}`,
          agencyId: agency.id,
          carId: car.id,
          clientId: client.id,
          startDate,
          endDate,
          actualReturnDate: isCompleted ? endDate : null,
          pickupLocation: `Agence ${agency.city}`,
          returnLocation: `Agence ${agency.city}`,
          totalDays,
          pricePerDay,
          subtotal,
          discountPercent,
          discountAmount,
          totalAmount,
          depositAmount,
          depositRefunded: isCompleted,
          status,
          startMileage: Number(car.mileage),
          endMileage: isCompleted ? Number(car.mileage) + totalDays * faker.number.int({ min: 50, max: 300 }) : null,
          fuelLevelStart: 'full',
          fuelLevelEnd: isCompleted ? faker.helpers.arrayElement(['full', '3/4', '1/2']) : null,
        },
      });

      // Payments
      if (status !== ReservationStatus.PENDING) {
        // Deposit payment
        await prisma.payment.create({
          data: {
            agencyId: agency.id,
            reservationId: reservation.id,
            amount: depositAmount,
            type: PaymentType.DEPOSIT,
            method: faker.helpers.arrayElement([PaymentMethod.CASH, PaymentMethod.CARD]),
            status: PaymentStatus.PAID,
            paidAt: startDate,
          },
        });

        // Rental payment
        await prisma.payment.create({
          data: {
            agencyId: agency.id,
            reservationId: reservation.id,
            amount: totalAmount,
            type: PaymentType.RENTAL,
            method: faker.helpers.arrayElement([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER]),
            status: isCompleted ? PaymentStatus.PAID : PaymentStatus.PENDING,
            paidAt: isCompleted ? startDate : null,
          },
        });

        // Deposit refund for completed
        if (isCompleted) {
          await prisma.payment.create({
            data: {
              agencyId: agency.id,
              reservationId: reservation.id,
              amount: depositAmount,
              type: PaymentType.REFUND,
              method: PaymentMethod.CASH,
              status: PaymentStatus.REFUNDED,
              paidAt: endDate,
              notes: 'Remboursement caution - véhicule rendu en bon état',
            },
          });
        }
      }
    }
    console.log(`✅ Reservations created for: ${agency.name}`);
  }

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('─────────────────────────────────────────');
  console.log('📧 Login credentials (password: Password123!)');
  console.log('─────────────────────────────────────────');
  console.log('👑 Super Admin  : admin@rental.ma');
  console.log('🏢 Agency Admin : manager@automaoclocation.ma');
  console.log('👨‍💼 Employee    : employee@automaoclocation.ma');
  console.log('💰 Accountant   : accountant@automaoclocation.ma');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
