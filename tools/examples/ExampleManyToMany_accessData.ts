// Example usage of the many-to-many relationship

import { Course, Student, Enrollment } from './models';

async function examples() {
  //=============================================
  // 1. Creating related records
  //=============================================
  
  // Create a course
  const mathCourse = await Course.create({
    title: 'Introduction to Calculus',
    code: 'MATH101',
  });
  
  // Create a student
  const student = await Student.create({
    name: 'John Doe',
    email: 'john.doe@example.com',
  });
  
  //=============================================
  // 2. Creating the association with custom attribute
  //=============================================
  
  // Method 1: Using the join table directly
  await Enrollment.create({
    courseId: mathCourse.id,
    studentId: student.id,
    grade: 85.5, // Our custom attribute
  });
  
  // Method 2: Using the association method with the through parameter
  const physicsCourse = await Course.create({
    title: 'Physics I',
    code: 'PHYS101',
  });
  
  await student.addCourse(physicsCourse, {
    through: { grade: 92.0 } // Setting the custom attribute
  });
  
  //=============================================
  // 3. Querying the many-to-many relationship
  //=============================================
  
  // Get all courses for a student
  const studentCourses = await student.getCourses();
  console.log('Student courses:', studentCourses.map(c => c.title));
  
  // Get all students for a course
  const mathStudents = await mathCourse.getStudents();
  console.log('Math students:', mathStudents.map(s => s.name));
  
  //=============================================
  // 4. Accessing the custom attribute
  //=============================================
  
  // Method 1: Include the join table when fetching associations
  const coursesWithGrades = await student.getCourses({
    include: [{
      model: Enrollment,
      as: 'Enrollment', // This is the default name Sequelize gives to the join table
      attributes: ['grade']
    }]
  });
  
  // Now the custom attribute is available
  coursesWithGrades.forEach(course => {
    console.log(`Course: ${course.title}, Grade: ${course.Enrollment.grade}`);
  });
  
  // Method 2: Query the join table directly
  const enrollments = await Enrollment.findAll({
    where: { studentId: student.id },
    include: [
      { model: Course },
      { model: Student }
    ]
  });
  
  enrollments.forEach(enrollment => {
    console.log(
      `Student: ${enrollment.Student.name}, ` +
      `Course: ${enrollment.Course.title}, ` +
      `Grade: ${enrollment.grade}`
    );
  });
  
  //=============================================
  // 5. Updating the custom attribute
  //=============================================
  
  // Find the specific enrollment record
  const mathEnrollment = await Enrollment.findOne({
    where: {
      studentId: student.id,
      courseId: mathCourse.id
    }
  });
  
  // Update the grade
  if (mathEnrollment) {
    mathEnrollment.grade = 88.0;
    await mathEnrollment.save();
    console.log(`Updated grade for ${student.name} in ${mathCourse.title} to ${mathEnrollment.grade}`);
  }
  
  //=============================================
  // 6. Advanced queries with the custom attribute
  //=============================================
  
  // Find all students with a grade above 90 in any course
  const highPerformers = await Student.findAll({
    include: [{
      model: Enrollment,
      where: { grade: { [Op.gte]: 90 } },
      include: [{ model: Course }]
    }]
  });
  
  console.log('High performing students:');
  highPerformers.forEach(student => {
    student.Enrollments.forEach(enrollment => {
      console.log(
        `${student.name} scored ${enrollment.grade} in ${enrollment.Course.title}`
      );
    });
  });
  
  // Find the average grade for a specific course
  const avgGrade = await Enrollment.findOne({
    where: { courseId: mathCourse.id },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('grade')), 'averageGrade']
    ],
    raw: true
  });
  
  console.log(`Average grade in ${mathCourse.title}: ${avgGrade.averageGrade}`);
}

// Run the examples
examples().catch(console.error);