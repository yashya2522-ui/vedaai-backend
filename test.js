const axios = require("axios");

const API_KEY = "";

async function test() {

try{

const response = await axios.post(

`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,

{
contents:[
{
parts:[
{text:"hello"}
]
}
]
}

);

console.log(response.data);

}

catch(e){

console.log("STATUS =",e.response?.status);

console.log("DATA =",e.response?.data);

}

}

test();