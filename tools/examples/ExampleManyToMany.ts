// Course.ts - First entity in the many-to-many relationship
import { Model, DataTypes } from 'sequelize';
import sequelize from './database'; // Your Sequelize instance
import Enrollment from './Enrollment';
import Student from './Student';

class Course extends Model {
  declare id: string;
  declare title: string;
  declare code: string;
  
  // Define association methods that Sequelize will add
  declare getStudents: () => Promise<Student[]>;
  declare addStudent: (student: Student, options?: {through: {grade?: number}}) => Promise<void>;
}

Course.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'courses',
  }
);

// Student.ts - Second entity in the many-to-many relationship
import { Model, DataTypes } from 'sequelize';
import sequelize from './database';
import Enrollment from './Enrollment';
import Course from './Course';

class Student extends Model {
  declare id: string;
  declare name: string;
  declare email: string;
  
  // Define association methods that Sequelize will add
  declare getCourses: () => Promise<Course[]>;
  declare addCourse: (course: Course, options?: {through: {grade?: number}}) => Promise<void>;
}

Student.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'students',
  }
);

// Enrollment.ts - The join table with a custom attribute
import { Model, DataTypes } from 'sequelize';
import sequelize from './database';
import Course from './Course';
import Student from './Student';

class Enrollment extends Model {
  declare courseId: string;
  declare studentId: string;
  declare grade: number | null; // This is our custom attribute in the join table
}

Enrollment.init(
  {
    grade: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'enrollments',
  }
);

// Set up the many-to-many relationship
Course.belongsToMany(Student, { 
  through: Enrollment,
  foreignKey: 'courseId',
  otherKey: 'studentId',
});

Student.belongsToMany(Course, { 
  through: Enrollment,
  foreignKey: 'studentId',
  otherKey: 'courseId',
});

// Access to the join model directly
Course.hasMany(Enrollment, { foreignKey: 'courseId' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId' });

Student.hasMany(Enrollment, { foreignKey: 'studentId' });
Enrollment.belongsTo(Student, { foreignKey: 'studentId' });

export { Course, Student, Enrollment };