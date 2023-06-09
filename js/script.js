function checkCookie(cookieName) {
  const cookies = document.cookie.split(";");

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();

    // Check if the cookie starts with the provided name
    if (cookie.startsWith(cookieName + "=")) {
      loadMainPage();
      return;
    }
  }

  loadLoginPage();
}

function loadLoginPage() {
  document.getElementsByTagName("body")[0].innerHTML = `
    <div class="login-container">
    <h2>Login with kood/Jõhvi credentials</h2>
    <form id="login-form">
      <label for="username">Username or email:</label>
      <input type="text" id="username" name="username" required>

      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required>

      <p id="error" style="visibility: hidden; color: red">Incorrect login or password</p>

      <input type="submit" value="Login">
    </form>
  </div>
    `;
  console.log(document.getElementById("login-form"));
  document
    .getElementById("login-form")
    .addEventListener("submit", async function (event) {
      event.preventDefault(); // Prevent form submission
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;
      tryToLogin(username, password);
    });
}

async function tryToLogin(username, password) {
  let jwt;
  const credentials = `${username}:${password}`;
  const encodedCredentials = btoa(`${username}:${password}`);
  await fetch("https://01.kood.tech/api/auth/signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${encodedCredentials}`,
    },
    body: JSON.stringify({}),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        let error = document.getElementById("error");
        error.style.visibility = "visible";
      }else {
        let error = document.getElementById("error");
        error.style.visibility = "hidden";
      }
      jwt = data;
      // Store the JWT token securely (e.g., in local storage or a cookie)
      document.cookie = `jwt=${jwt}; HttpOnly`; // Set the cookie 'jwt' with the JWT token
    })
    .catch((error) => {
      // Handle invalid credentials or other errors
      console.error("Login failed:", error);
    });
  loadMainPage(jwt);
}
async function loadMainPage(jwt) {
  var userData, transactionData;
  await fetch("https://01.kood.tech/api/graphql-engine/v1/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      query: `
    {
      user {
        id
        login
        campus
        lastName
        firstName
        auditRatio
        email
        totalUp
        totalDown
      }
      transaction(
        where: {
          path: {_regex: "^\\/johvi\\/div-01\\/[-\\\\w]+$"}
          type: {_eq:"xp"}
        }
      ) {
        amount
        path
      }
      progress(
        where: {
          path: {_regex: "^\\/johvi\\/div-01\\/[-\\\\w]+$"}
          isDone: {_eq: true}
        }
      ) {
        results {
          grade
        }
      }
    }
    `,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      userData = data.data.user[0];
      transactionData = data.data.transaction;
    })
    .catch((error) => {
      console.log(error);
    });

  document.body.innerHTML = `
    <div class="header">
    <table id="user-data">
      <tr>
        <th>Firstname</th>
        <th>Lastname</th>
        <th>Login</th>
        <th>Email</th>
        <th>Campus</th>
        <th>Audit ratio</th>
        <th>XP received</th>
        <th>XP given</th>
      </tr>
      <tr>
        <td>${userData.firstName}</td>
        <td>${userData.lastName}</td>
        <td>${userData.login}</td>
        <td>${userData.email}</td>
        <td>${userData.campus}</td>
        <td>${userData.auditRatio}</td>
        <td>${userData.totalDown.toFixed(1)}</td>
        <td>${userData.totalUp.toFixed(1)}</td>
      </tr>
    </table>
    <button class="button-37" role="button" style="height: 40px">
      Logout
    </button>
  </div>
  <div
    class="graph-headings"
    style="
      display: flex;
      justify-content: space-evenly;
      margin-top: 50px;
      font-size: 16px;
      font-weight: bold;
    "
  >
    <p style="margin-right: 100px">Xp per project</p>
    <p style="margin-left: 300px">Xp ratio</p>
  </div>
  <div class="smallerBody" style="display: flex; justify-content: center">
    <div class="chart-container" style="margin-left: 100px; margin-top: 70px">
      <div id="chart"></div>
      <div class="chart-labels"></div>
    </div>
    <div style="display: flex; justify-content: center">
      <svg class="circle">
        <path
          id="sector-path-up"
          d=""
          fill=""
          stroke="none"
          transform=""
          text-anchor="middle"
        />
        <text
          id="sector-label-up"
          dy="0.35em"
          text-anchor="middle"
          fill="white"
        ></text>
        <path
          id="sector-path-down"
          d=""
          fill=""
          stroke="none"
          transform=""
          text-anchor="middle"
        />
        <text
          id="sector-label-down"
          dy="0.35em"
          text-anchor="middle"
          fill="white"
        ></text>
      </svg>
    </div>
  </div>
    `;
  document.getElementsByTagName("button")[0].addEventListener("click", () => {
    document.cookie = `jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    loadLoginPage();
  });
  // Access the XP graph data from the server-side
  const xpGraphData = transactionData;
  // Sort the data by amount in descending order
  xpGraphData.sort((a, b) => b.amount - a.amount);
  // Extract the bar names from the paths
  const barNames = xpGraphData.map((item) => {
    const pathParts = item.path.split("/");
    return pathParts[pathParts.length - 1];
  });

  // Extract the amounts for the bars
  const amounts = xpGraphData.map((item) => item.amount);
  // Set up the chart dimensions
  const chartWidth = 600;
  const chartHeight = 300;
  const barPadding = 8;

  // Create the SVG container for the chart
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  // Create the scales for x and y axes
  const xScale = d3
    .scaleBand()
    .domain(barNames)
    .range([0, chartWidth])
    .padding(0.4);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(amounts)])
    .range([chartHeight, 0]);

  // Create the bars
  svg
    .selectAll("rect")
    .data(xpGraphData)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.path.split("/").pop()))
    .attr("y", (d) => yScale(d.amount))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => chartHeight - yScale(d.amount))
    .attr("fill", "steelblue");

  const labels = d3
    .select(".chart-labels")
    .selectAll(".chart-label")
    .data(xpGraphData)
    .enter()
    .append("div")
    .attr("class", "chart-label")
    .style("left", (d) => xScale(d.path.split("/").pop()) + "px")
    .style("width", xScale.bandwidth() + "px")
    .style("transform", "rotate(45deg)")
    .style("text-align", "center")
    .style("white-space", "nowrap")
    .text((d) => {
      const projectName = d.path.split("/").pop();
      return projectName;
    });

  // Create x-axis
  const xAxis = d3.axisBottom(xScale);
  svg.append("g").attr("transform", `translate(0, ${chartHeight})`);

  // Calculate the maximum XP value and round it up to the nearest round number
  const maxXP = Math.ceil(d3.max(amounts));

  // Determine the interval for additional values on the y-axis
  const interval = Math.ceil(maxXP / 5);

  // Create an array for additional y-axis labels
  const yAxisLabels = [];
  for (let i = 1; i <= 5; i++) {
    yAxisLabels.push(i * interval);
  }
  console.log(yAxisLabels);
  // Update the yScale domain to include the maximum XP value
  yScale.domain([0, maxXP]);

  // Create y-axis with additional labels
  const yAxis = d3.axisLeft(yScale).tickValues([0, ...yAxisLabels]);

  // Append the y-axis to the SVG container
  svg.append("g").call(yAxis).selectAll("text").attr("font-size", "12px");

  // Access the XP data from the server-side
  const totalXP = userData.totalUp + userData.totalDown;
  const xpRatio = userData.totalUp / totalXP;
  console.log(userData.totalUp, userData.totalDown);

  // Define the colors for the sectors
  const colorUp = "green"; // Color for XP given
  const colorDown = "orange"; // Color for XP received

  // Calculate the angles for the sectors
  const angleUp = xpRatio * 360;
  const angleDown = (1 - xpRatio) * 360;
  console.log(angleUp, angleDown);

  // Convert the angles to radians
  const radiansUp = (angleUp * Math.PI) / 180;
  const radiansDown = (angleDown * Math.PI) / 180;

  // Calculate the sector path commands
  const sectorCommandsUp = `
            M 150 150
            L ${150 + 100 * Math.cos(0)} ${150 + 100 * Math.sin(0)}
            A 100 100 0 ${angleUp > 180 ? 1 : 0} 1 ${
    150 + 100 * Math.cos(radiansUp)
  } ${150 + 100 * Math.sin(radiansUp)}
            Z
          `;

  const sectorCommandsDown = `
            M 150 150
            L ${150 + 100 * Math.cos(0)} ${150 + 100 * Math.sin(0)}
            A 100 100 0 ${angleDown > 180 ? 1 : 0} 0 ${
    150 + 100 * Math.cos(-radiansDown)
  } ${150 + 100 * Math.sin(-radiansDown)}
            Z
          `;

  // Update the sector paths in the SVG
  const sectorPathUp = d3.select("#sector-path-up");
  const sectorPathDown = d3.select("#sector-path-down");
  const sectorLabelUp = d3.select("#sector-label-up");
  const sectorLabelDown = d3.select("#sector-label-down");

  sectorPathUp.attr("d", sectorCommandsUp);
  sectorPathUp.attr("fill", colorUp);
  sectorPathDown.attr("d", sectorCommandsDown);
  sectorPathDown.attr("fill", colorDown);

  sectorLabelUp.text("Given");
  sectorLabelDown.text("Received");

  // Calculate the mid-angle of each sector
  const midAngleUp = (angleUp / 2) * (Math.PI / 180);
  const midAngleDown = (180 + angleDown / 2) * (Math.PI / 180);

  // Calculate the coordinates for the label positions
  const radius = 50;
  const labelXUp = 150 + radius * Math.cos(midAngleUp);
  const labelYUp = 150 + radius * Math.sin(midAngleUp);
  const labelXDown = 150 + radius * Math.cos(midAngleDown);
  const labelYDown = 150 + radius * Math.sin(midAngleDown);

  // Position the labels at the calculated coordinates
  sectorLabelUp.attr("x", labelXUp);
  sectorLabelUp.attr("y", labelYUp);
  sectorLabelDown.attr("x", labelXDown);
  sectorLabelDown.attr("y", labelYDown);
}
