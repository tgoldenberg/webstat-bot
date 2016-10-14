var find = require('underscore').find;
var flatten = require('underscore').flatten;

class ElasticSearch{
  flattenSuggestedKeywords(keyword, suggestion){
    return (
      flatten(suggestion.categories.map(category => category.keywords))
        .filter(kw => kw.selected == true)
        .map(kw => kw.value)
    );
  }

  constructSources(selectedSources){
    return {
      _id         : selectedSources.filter(s => !s.isPublisher).map(s => s._id),
      publisher   : selectedSources.filter(s => s.isPublisher).map(s => s._id)
    }
  }

  getSortingParams(sort){
    switch(sort){
      case 'relevant':
        return [
          { _score: { order: 'desc' }}
        ];
      case 'newest':
        return [
          { created_at: { order: 'desc' }}
        ];
      case 'updated':
        return [
          { last_updated_at: { order: 'desc' }}
        ];
      default:
        return [
          { _score: { order: 'desc' }}
        ]
    }
  }

  createBoolQuery(keyword, fields){
    return {
      "bool": {
        "should": [
          {
            "multi_match": {
              "query"     : keyword.value,
              "fields"    : fields,
              "type"      : "phrase"
            }
          }
        ]
      }
    }
  }

  createQuery(keywords, suggestedKeywords, fields, isExcluded){
    return (
      keywords.map(keyword => {
        let query = this.createBoolQuery(keyword, fields);
        let suggestedKeyword = find(suggestedKeywords, (s) => s.value === keyword.value);
        if (suggestedKeyword && ! isExcluded){
          let suggestedTerms = this.flattenSuggestedKeywords(keyword.value, suggestedKeyword);
          if (suggestedTerms.length) {
            query.bool.should.push({
              "bool": {
                "should": suggestedTerms.map(term => ({
                  "multi_match": {
                    "query"   : term,
                    "fields"  : fields,
                    "type"    : "phrase"
                  }
                }))
              }
            });
          }
        }
        return query;
      })
    )
  }
  constructQuery(keywords, suggestedKeywords, fields){
    let shouldKeywords    = keywords.filter(k => k.type === 'included');
    let should            = this.createQuery(shouldKeywords, suggestedKeywords, fields, false);
    let mustKeywords      = keywords.filter(k => k.type === 'musthave');
    let must              = this.createQuery(mustKeywords, suggestedKeywords, fields, false);
    let mustNotKeywords   = keywords.filter(k => k.type === 'excluded');
    let must_not          = this.createQuery(mustNotKeywords, suggestedKeywords, fields, true);
    return {
      "bool": { should, must, must_not }
    };
  }

  constructUsers(userId, emailNotifications){
    return [
      {
        user_id: userId,
        invitor_id: null,
        role: 'owner',
        notifications: {
          email: emailNotifications
        },
        confirmed: true,
        joined_at: new Date()
      }
    ]
  }
}

const Elastic = new ElasticSearch();

export default Elastic;
