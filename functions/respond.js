const { AzureOpenAI } = require("openai");
const dotenv = require("dotenv");

dotenv.config();

// Define the main function for handling requests
exports.handler = async function(context, event, callback) {
  // Set up the OpenAI API with the API key from your environment variables
  const deployment = "SehatSaheli";
    const apiVersion = "2024-05-01-preview";
    const apiKey = "3fcdb15abb9243e4add7ed4b35d96d70";
    const endpoint = "https://sehatsaheli.openai.azure.com/";
    const options = { endpoint, apiKey, deployment, apiVersion }
    const client = new AzureOpenAI(options);

  // Set up the Twilio VoiceResponse object to generate the TwiML
  const twiml = new Twilio.twiml.VoiceResponse();

  // Initiate the Twilio Response object to handle updating the cookie with the chat history
  const response = new Twilio.Response();

  // Parse the cookie value if it exists
  const cookieValue = event.request.cookies.convo;
  const cookieData = cookieValue ? JSON.parse(decodeURIComponent(cookieValue)) : null;

  // Get the user's voice input from the event
  let voiceInput = event.SpeechResult;

  // Create a conversation object to store the dialog and the user's input to the conversation history
  const conversation = cookieData?.conversation || [];
  conversation.push({role: 'user', content: voiceInput});

  // Get the AI's response based on the conversation history
  const aiResponse = await createChatCompletion(conversation);


  // Add the AI's response to the conversation history
  conversation.push(aiResponse);

  // Limit the conversation history to the last 20 messages; you can increase this if you want but keeping things short for this demonstration improves performance
  while (conversation.length > 20) {
      conversation.shift();
  }

  // Generate some <Say> TwiML using the cleaned up AI response
  twiml.say({
          voice: "Polly.Ruth-Neural",
      },
      aiResponse
  );

  // Redirect to the Function where the <Gather> is capturing the caller's speech
  twiml.redirect({
          method: "POST",
      },
      `/transcribe`
  );

  // Since we're using the response object to handle cookies we can't just pass the TwiML straight back to the callback, we need to set the appropriate header and return the TwiML in the body of the response
  response.appendHeader("Content-Type", "application/xml");
  response.setBody(twiml.toString());

  // Update the conversation history cookie with the response from the OpenAI API
  const newCookieValue = encodeURIComponent(JSON.stringify({
      conversation
  }));
  response.setCookie('convo', newCookieValue, ['Path=/']);

  // Return the response to the handler
  return callback(null, response);

  // Function to generate the AI response based on the conversation history
  async function generateAIResponse(conversation) {
      const messages = formatConversation(conversation);
      return await createChatCompletion(messages);
  }

  // Function to create a chat completion using the OpenAI API
  async function createChatCompletion(messages) {
      try {
        // Define system messages to model the AI
        const systemMessages = [{
                role: "system",
                content: 'You are a medical consultant named Saheli. You are supposed to act as a companion for rural women and talk in Hindi. Women in India currently experience a spectrum of health challenges, such as adolescent pregnancy, maternal mortality, and violence against women. Social discrimination against women has resulted into neglect of womens health from womb to tomb, especially in the rural parts of India. Women in India go through gender bias, resulting in limited or no access to quality healthcare. Many stereotypes in India forbid women to voice out about the health issues they must face. \"Sehat Saheli\" is an honest attempt to make the lives of women, an essential pillar of the family and society, just a little bit better by spreading awareness and providing the right tools. Please provide engaging but concise responses. Alsp, feel free to ask questions if any additional information is needed to diagnose the issue.'
            },
            // {
            //     role: "user",
            //     content: messages
            // },
        ];
        messages = systemMessages.concat(messages);
        console.log(messages);

        const chatCompletion = await client.chat.completions.create({
            messages: messages,
            model: 'gpt-35-turbo',
            temperature: 0.8, // Controls the randomness of the generated responses. Higher values (e.g., 1.0) make the output more random and creative, while lower values (e.g., 0.2) make it more focused and deterministic. You can adjust the temperature based on your desired level of creativity and exploration.
              max_tokens: 5000, // You can adjust this number to control the length of the generated responses. Keep in mind that setting max_tokens too low might result in responses that are cut off and don't make sense.
              top_p: 0.9, // Set the top_p value to around 0.9 to keep the generated responses focused on the most probable tokens without completely eliminating creativity. Adjust the value based on the desired level of exploration.
              n: 1, // Specifies the number of completions you want the model to generate. Generating multiple completions will increase the time it takes to receive the responses.
        });
        console.log(chatCompletion.choices[0].message.content);
        return chatCompletion.choices[0].message.content;

      } catch (error) {
          console.error("Error during OpenAI API request:", error);
          throw error;
      }
  }
}