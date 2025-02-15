let selectedRating = 0;

// Set star rating
function setRating(rating) {
  selectedRating = rating;
  let stars = document.querySelectorAll(".star");
  stars.forEach((star, index) => {
    star.classList.toggle("selected", index < rating);
  });
}

// Submit Review
async function submitReview() {
  const name = document.getElementById("name").value.trim();
  const reviewText = document.getElementById("review-text").value.trim();

  if (!name || !reviewText || selectedRating === 0) {
    alert("Please fill in all fields and select a rating.");
    return;
  }

  // Send review to server
  const response = await fetch("/submit-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, rating: selectedRating, review: reviewText }),
  });

  if (response.ok) {
    alert("Review submitted successfully!");
    loadReviews(); // Reload reviews
  } else {
    alert("Error submitting review. Please try again.");
  }
}

// Load and display reviews
async function loadReviews() {
  const response = await fetch("/get-reviews");
  const reviews = await response.json();
  const container = document.getElementById("reviews-container");
  container.innerHTML = ""; // Clear previous reviews

  reviews.forEach((review) => {
    const reviewElement = document.createElement("div");
    reviewElement.classList.add("review");
    reviewElement.innerHTML = `
            <strong>${review.name}</strong> - ${"★".repeat(review.rating)}
            <p>${review.review}</p>
        `;
    container.appendChild(reviewElement);
  });
}

// Load reviews on page load
document.addEventListener("DOMContentLoaded", loadReviews);
