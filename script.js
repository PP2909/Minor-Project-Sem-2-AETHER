function login() {
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;
  let message = document.getElementById("message");

  // ✅ Validation
  if (email === "" || password === "") {
    message.innerText = "Please fill all fields";
    message.style.color = "red";
    return;
  }

  // ✅ Send data to backend (dummy API)
  fetch("https://jsonplaceholder.typicode.com/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: email,
      password: password
    })
  })
  .then(response => response.json())
  .then(data => {
    message.innerText = "Login Successful!";
    message.style.color = "green";
    console.log(data);
  })
  .catch(error => {
    message.innerText = "Error occurred!";
    message.style.color = "red";
  });
}
