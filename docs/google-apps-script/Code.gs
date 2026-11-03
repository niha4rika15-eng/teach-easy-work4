/**
 * Teach Easy → Google Forms publisher (Apps Script web app).
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me    Who has access: Anyone
 * Copy the /exec URL into the server variable google_gorm_api.
 * Request body (JSON): { title, description, questions: [{ question, options[], correctAnswer, points, explanation? }] }
 * Response (JSON): { success: true, formUrl, editUrl, formId }
 */
function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload.title || !Array.isArray(payload.questions) || !payload.questions.length) {
      return json_({ success: false, error: 'title and at least one question are required' });
    }
    var form = FormApp.create(String(payload.title).slice(0, 200));
    form.setDescription(String(payload.description || ''));
    form.setIsQuiz(true);
    payload.questions.forEach(function (q) {
      var item = form.addMultipleChoiceItem();
      item.setTitle(String(q.question));
      item.setPoints(Number(q.points) || 1);
      item.setChoices(q.options.map(function (option) {
        return item.createChoice(String(option), option === q.correctAnswer);
      }));
      if (q.explanation) {
        item.setFeedbackForCorrect(FormApp.createFeedback().setText(String(q.explanation)).build());
      }
    });
    return json_({ success: true, formId: form.getId(), formUrl: form.getPublishedUrl(), editUrl: form.getEditUrl() });
  } catch (error) {
    return json_({ success: false, error: String(error) });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
