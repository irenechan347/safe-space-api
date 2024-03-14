var express = require("express");
var multer = require("multer"); // For handling file uploads
const cors = require("cors");
var fs = require("fs");
var path = require("path");
const db = require("./db"); // Adjust the path based on your project structure

const bodyParser = require("body-parser");
const app = express();

const bcrypt = require("bcrypt");
const saltRounds = 10; // You can adjust the number of salt rounds as needed

// Configure Multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware to parse JSON body
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

// Testing API
app.get("/persons", async (req, res) => {
  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query
    const result = await db.query`SELECT * FROM Persons`;

    // Send the result as JSON response
    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

//-----------new post for blog-----------
// Get all blog posts
app.get("/blogposts", async (req, res) => {
  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query
    const result = await db.query`SELECT 
        blogPostId,
        blogCategoryId,
        blogCategoryName,
        topic,
        content,
        createdDate,
        blogCategoryPath,
        profileImgPath
      FROM BlogPosts`;

    // Send the result as JSON response
    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (
      connection &&
      connection._connecting === false &&
      connection._pool &&
      connection._pool._pendingRequests.length === 0
    ) {
      connection.close();
    }
  }
});

// Get all blog posts by category name
app.get("/blogpostsbycategory", async (req, res) => {
  const { blogCategoryName } = req.query;
  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query to get the blog posts filtered by category name
    const result = await db.query`
      SELECT * FROM BlogPosts WHERE blogCategoryName = ${blogCategoryName};
    `;

    // Send the result as JSON response
    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

// Get blog post by topic
app.get("/blogpostsbytopic", async (req, res) => {
  const { topic } = req.query;
  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query to get the blog post by topic
    let result = await db.query`
      SELECT *
      FROM BlogPosts
      WHERE topic = ${topic};
    `;
    console.log(result.recordset[0]);
    if (result.recordset[0].profileImg) {
      result.recordset[0].profileImg = `data:image/png;base64,${result.recordset[0].profileImg.toString(
        "base64"
      )}`;
    }

    // Send the result as a JSON response
    res.json(result.recordset[0]); // Assuming there's only one post per topic
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

// Add a new blog post
app.post("/blogposts", upload.single("file"), async (req, res) => {
  let connection;
  try {
    const { blogCategoryId, blogCategoryName, topic, content, createdDate } =
      req.body;

    // Get the binary image data from the buffer
    const binaryImageData = req.file.buffer;

    // Connect to the database
    connection = await db.connect();

    // Execute the query to insert a new blog post with image data
    await db.query`
      INSERT INTO BlogPosts (blogCategoryId, blogCategoryName, topic, content, profileImg, createdDate)
      VALUES (${blogCategoryId}, ${blogCategoryName}, ${topic}, ${content}, ${binaryImageData}, ${createdDate});
    `;

    // Send a success response
    res.status(201).json({ message: "Blog post added successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

//PUT API for modifying the blog post
app.put("/blogposts/:blogPostId", upload.single("file"), async (req, res) => {
  let connection;
  try {
    const { blogPostId } = req.params;
    const { blogCategoryId, blogCategoryName, topic, content, createdDate } =
      req.body;

    // Check if an image is being uploaded
    const binaryImageData = req.file ? req.file.buffer : null;

    // Connect to the database
    connection = await db.connect();

    // Build the dynamic part of the query based on the presence of image data
    let query = db.query`UPDATE BlogPosts SET 
                          blogCategoryId = ${blogCategoryId},
                          blogCategoryName = ${blogCategoryName},
                          topic = ${topic},
                          content = ${content},
                          createdDate = ${createdDate}`;

    // Include image data in the query if available
    if (binaryImageData) {
      query = query.append`, profileImg = ${binaryImageData}`;
    }

    // Complete the query
    query = query.append` WHERE blogPostId = ${blogPostId};`;

    // Execute the query to update the blog post
    await query;

    // Send a success response
    res.status(200).json({ message: "Blog post updated successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

//DELETE API for deleting the blog post
//When there is no more blog post, the correspondent category will be deleted together
app.delete("/blogposts/:blogPostId", async (req, res) => {
  let connection;
  try {
    const { blogPostId } = req.params;

    // Connect to the database
    connection = await db.connect();

    // Check if there are any blog posts in the same category
    const categoryCheckResult = await db.query`
      SELECT blogCategoryId
      FROM BlogPosts
      WHERE blogPostId = ${blogPostId};
    `;

    if (
      !categoryCheckResult.recordset ||
      categoryCheckResult.recordset.length === 0
    ) {
      // No matching blog post found, send an error response
      return res.status(404).json({ error: "Blog post not found" });
    }

    const blogCategoryId = categoryCheckResult.recordset[0].blogCategoryId;

    // Delete the blog post
    await db.query`DELETE FROM BlogPosts WHERE blogPostId = ${blogPostId};`;

    // Check if there are any remaining blog posts in the same category
    const remainingPostsResult = await db.query`
      SELECT COUNT(*) AS postCount
      FROM BlogPosts
      WHERE blogCategoryId = ${blogCategoryId};
    `;

    if (remainingPostsResult.recordset[0].postCount === 0) {
      // No remaining blog posts in the category, delete the category
      await db.query`DELETE FROM BlogCategories WHERE blogCategoryId = ${blogCategoryId};`;
    }

    // Send a success response
    res.status(200).json({ message: "Blog post deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

//GET API to list the latest 10 blog posts including all categories
app.get("/latestblogposts", async (req, res) => {
  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query to get the latest 10 blog posts
    const result = await db.query`
      SELECT TOP 10 *
      FROM BlogPosts
      ORDER BY createdDate DESC;
    `;

    // Send the result as a JSON response
    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

//GET API to list the latest 10 blog posts for each category (by category id)
app.get("/latesttenblogposts/:categoryId", async (req, res) => {
  const { categoryId } = req.params;

  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query to get the latest 10 blog posts for the specified category
    const result = await db.query`
      SELECT TOP 10 *
      FROM BlogPosts
      WHERE blogCategoryId = ${categoryId}
      ORDER BY createdDate DESC;
    `;

    // Send the result as a JSON response
    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (connection) {
      connection.close();
    }
  }
});

// Get all blog categories with at least one blog post
app.get("/blogcategories", async (req, res) => {
  let connection;

  try {
    connection = await db.connect();

    // Use a subquery to filter categories with at least one associated blog post
    const result = await db.query`
      SELECT DISTINCT
        bc.blogCategoryId,
        bc.blogCategoryName,
        bc.blogCategoryPath
      FROM BlogCategories bc
      LEFT JOIN BlogPosts bp ON bc.blogCategoryId = bp.blogCategoryId
      WHERE bp.blogCategoryId IS NOT NULL;
    `;

    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (
      connection &&
      connection._connecting === false &&
      connection._pool &&
      connection._pool._pendingRequests.length === 0
    ) {
      connection.close();
    }
  }
});

//Get the latest “Featured” blog post
app.get("/latestfeaturedblogpost", async (req, res) => {
  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query to get the latest 1 blog post
    const result = await db.query`
      SELECT TOP 1 *
      FROM BlogPosts
      WHERE isFeatured = 'true'
      ORDER BY createdDate DESC;
    `;

    // Send the result as a JSON response
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (
      connection &&
      connection._connecting === false &&
      connection._pool &&
      connection._pool._pendingRequests.length === 0
      ) {
      connection.close();
    }
  }
});

//Get the latest “Featured” blog post by category id
app.get("/latestfeaturedblogpost/:categoryId", async (req, res) => {
  const { categoryId } = req.params;

  let connection;
  try {
    // Connect to the database
    connection = await db.connect();

    // Execute the query to get the latest 1 blog post for the specified category
    const result = await db.query`
      SELECT TOP 1 *
      FROM BlogPosts
      WHERE blogCategoryId = ${categoryId}
      AND isFeatured = 'true'
      ORDER BY createdDate DESC;
    `;

    // Send the result as a JSON response
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the connection pool only if the connection was successfully established
    if (
      connection &&
      connection._connecting === false &&
      connection._pool &&
      connection._pool._pendingRequests.length === 0
      ) {
      connection.close();
    }
  }
});

//Get the full list of blog post by category id (sort in descending order by date)
app.get("/blogcategories/:categoryId/blogposts", async (req, res) => {
  let connection;

  try {
    const categoryId = req.params.categoryId;

    connection = await db.connect();

    const result = await db.query`
      SELECT *
      FROM BlogPosts
      WHERE blogCategoryId = ${categoryId}
      ORDER BY createdDate DESC;
    `;

    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) {
      connection.close();
    }
  }
});

//GET API for 1 particular blog post by post id
app.get("/blogposts/:postId", async (req, res) => {
  let connection;

  try {
    const postId = req.params.postId;

    connection = await db.connect();

    const result = await db.query`
      SELECT 
        blogPostId,
        blogCategoryId,
        blogCategoryName,
        topic,
        content,
        createdDate,
        blogCategoryPath,
        profileImgPath
      FROM BlogPosts
      WHERE blogPostId = ${postId};
    `;

    // Check if a blog post with the given post id exists
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    const blogPost = result.recordset[0];
    res.json(blogPost);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (
      connection &&
      connection._connecting === false &&
      connection._pool &&
      connection._pool._pendingRequests.length === 0
    ) {
      connection.close();
    }
  }
});

// Add a new blog category
app.post("/blogcategories", async (req, res) => {
  let connection;
  try {
    const { blogCategoryId, blogCategoryName, blogCategoryPath } = req.body;

    connection = await db.connect();

    await db.query`
      INSERT INTO BlogCategories (blogCategoryId, blogCategoryName, blogCategoryPath)
      VALUES (${blogCategoryId}, ${blogCategoryName}, ${blogCategoryPath});
    `;

    res.status(201).json({ message: "Blog category added successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) {
      connection.close();
    }
  }
});

//PUT API for modifying category
app.put("/blogcategories/:id", async (req, res) => {
  let connection;
  try {
    const categoryId = req.params.id;
    const { blogCategoryName, blogCategoryPath } = req.body;

    connection = await db.connect();

    // Update the specified blog category
    await db.query`
      UPDATE BlogCategories
      SET
        blogCategoryName = ${blogCategoryName},
        blogCategoryPath = ${blogCategoryPath}
      WHERE blogCategoryId = ${categoryId};
    `;

    res.status(200).json({ message: "Blog category updated successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) {
      connection.close();
    }
  }
});

//DELETE API for deleting blog category
app.delete("/blogcategories/:id", async (req, res) => {
  let connection;
  try {
    const categoryId = req.params.id;

    connection = await db.connect();

    // Delete the specified blog category
    await db.query`
      DELETE FROM BlogCategories
      WHERE blogCategoryId = ${categoryId};
    `;

    res.status(200).json({ message: "Blog category deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) {
      connection.close();
    }
  }
});

//GET API to retrieve all blog categories
app.get("/allblogcategories", async (req, res) => {
  let connection;
  try {
    connection = await db.connect();

    const result = await db.query`SELECT * FROM BlogCategories`;

    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) {
      connection.close();
    }
  }
});

//Admin Login API
app.post("/admin/login", async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    console.log("Login attempt for username:", username); // Log the username attempting to log in

    // Connect to the database
    connection = await db.connect();

    // Check if the username exists in the database
    const userResult =
      await db.query`SELECT * FROM AdminCredentials WHERE username = ${username}`;
    console.log(userResult);
    const user = userResult.recordset[0];

    if (!user) {
      console.log("User not found:", username);
      return res
        .status(401)
        .json({ result: false, message: "Invalid username or password" });
    }

    // Check if the provided password matches the stored hashed password
    // const passwordMatch = await bcrypt.compare(password, user.password);

    if (password !== user.password) {
      console.log("Incorrect password for user:", username);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // You can include additional checks or data in the response if needed
    console.log("Login successful for user:", username);
    return res.json({ result: true, message: "Login successful" });
  } catch (error) {
    console.error("Error during login:", error);

    // Return the detailed error message in the response for debugging
    return res.status(500).json({ error: error.message });
  } finally {
    // Close the database connection in the finally block
    if (connection) {
      connection.close();
    }
  }
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});

module.exports = app;